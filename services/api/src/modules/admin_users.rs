use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{errors::AppError, modules::auth::require_admin, state::AppState};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminAccount {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub is_disabled: bool,
    pub disabled_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupQuery {
    pub steam_id64: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LookupUser {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub is_disabled: bool,
    pub is_system: bool,
}

#[derive(Debug, Serialize)]
pub struct LookupResponse {
    pub user: Option<LookupUser>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAdminRequest {
    pub steam_id64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisableAdminRequest {
    pub reason: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/admins", get(list_admins).post(add_admin))
        .route("/admin/users/lookup", get(lookup_user))
        .route("/admin/admins/{steam_id64}", delete(remove_admin))
        .route("/admin/admins/{steam_id64}/disable", post(disable_admin))
        .route("/admin/admins/{steam_id64}/enable", post(enable_admin))
}

fn validate_steam_id(value: &str) -> Result<String, AppError> {
    let value = value.trim();
    if value.len() != 17 || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(AppError::Validation(
            "steamId64 must be a 17-digit number".to_owned(),
        ));
    }
    Ok(value.to_owned())
}

async fn active_admin_count(state: &AppState) -> Result<i64, AppError> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM users WHERE role = 'admin' AND is_disabled = false AND is_system = false",
    )
    .fetch_one(&state.db)
    .await?;
    Ok(count)
}

async fn list_admins(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminAccount>>, AppError> {
    require_admin(&state, &headers).await?;
    let admins = sqlx::query_as::<_, AdminAccount>(
        r"
        SELECT steam_id64, persona_name AS name, avatar_url, role, is_disabled,
               disabled_reason, created_at, last_login_at
        FROM users
        WHERE role = 'admin' AND is_system = false
        ORDER BY is_disabled, created_at
        ",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(admins))
}

async fn lookup_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<LookupQuery>,
) -> Result<Json<LookupResponse>, AppError> {
    require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&query.steam_id64)?;
    let user = sqlx::query_as::<_, LookupUser>(
        "SELECT steam_id64, persona_name AS name, avatar_url, role, is_disabled, is_system FROM users WHERE steam_id64 = $1",
    )
    .bind(steam_id64)
    .fetch_optional(&state.db)
    .await?;
    Ok(Json(LookupResponse { user }))
}

async fn add_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<AddAdminRequest>,
) -> Result<Json<AdminAccount>, AppError> {
    require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&request.steam_id64)?;

    let existing = sqlx::query_as::<_, (uuid::Uuid, String, bool, bool)>(
        "SELECT id, role, is_disabled, is_system FROM users WHERE steam_id64 = $1",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?;

    if let Some((_, _, _, is_system)) = &existing
        && *is_system
    {
        return Err(AppError::Conflict);
    }
    if let Some((_, role, is_disabled, _)) = &existing
        && role == "admin"
        && !*is_disabled
    {
        return Err(AppError::Conflict);
    }
    if let Some((id, _, _, _)) = &existing {
        let banned = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM bans WHERE steam_id64 = $1 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()))",
        )
        .bind(&steam_id64)
        .fetch_one(&state.db)
        .await?;
        if banned {
            return Err(AppError::Conflict);
        }
        let _ = id;
    }

    let fallback_name = format!("Steam 用户 {}", &steam_id64[steam_id64.len() - 6..]);
    let admin = sqlx::query_as::<_, AdminAccount>(
        r"
        INSERT INTO users (steam_id64, persona_name, role, is_disabled)
        VALUES ($1, $2, 'admin', false)
        ON CONFLICT (steam_id64) DO UPDATE SET
            role = 'admin',
            is_disabled = false,
            disabled_at = NULL,
            disabled_reason = NULL,
            updated_at = now()
        RETURNING steam_id64, persona_name AS name, avatar_url, role, is_disabled,
                  disabled_reason, created_at, last_login_at
        ",
    )
    .bind(&steam_id64)
    .bind(fallback_name)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(admin))
}

async fn remove_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(steam_id64): Path<String>,
) -> Result<StatusCode, AppError> {
    let current = require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&steam_id64)?;
    let target = load_target(&state, &steam_id64).await?;

    if target.steam_id64 == current.steam_id64 {
        return Err(AppError::bad_request(
            "You cannot remove your own admin role",
        ));
    }
    if target.is_system {
        return Err(AppError::Forbidden);
    }
    if target.role != "admin" {
        return Err(AppError::Conflict);
    }
    if !target.is_disabled && active_admin_count(&state).await? <= 1 {
        return Err(AppError::Conflict);
    }

    sqlx::query("UPDATE users SET role = 'member', updated_at = now() WHERE id = $1")
        .bind(target.id)
        .execute(&state.db)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(target.id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn disable_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(steam_id64): Path<String>,
    Json(request): Json<DisableAdminRequest>,
) -> Result<StatusCode, AppError> {
    let current = require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&steam_id64)?;
    let target = load_target(&state, &steam_id64).await?;

    if target.steam_id64 == current.steam_id64 {
        return Err(AppError::bad_request("You cannot disable your own account"));
    }
    if target.is_system {
        return Err(AppError::Forbidden);
    }
    if target.role != "admin" {
        return Err(AppError::Conflict);
    }
    if target.is_disabled {
        return Err(AppError::Conflict);
    }
    if active_admin_count(&state).await? <= 1 {
        return Err(AppError::Conflict);
    }

    let reason = request
        .reason
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(500).collect::<String>());

    sqlx::query(
        "UPDATE users SET is_disabled = true, disabled_at = now(), disabled_reason = $2, updated_at = now() WHERE id = $1",
    )
    .bind(target.id)
    .bind(reason)
    .execute(&state.db)
    .await?;
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(target.id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn enable_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(steam_id64): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&steam_id64)?;
    let target = load_target(&state, &steam_id64).await?;
    if target.is_system {
        return Err(AppError::Forbidden);
    }
    if target.role != "admin" {
        return Err(AppError::Conflict);
    }
    sqlx::query(
        "UPDATE users SET is_disabled = false, disabled_at = NULL, disabled_reason = NULL, updated_at = now() WHERE id = $1",
    )
    .bind(target.id)
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, FromRow)]
struct TargetUser {
    id: uuid::Uuid,
    steam_id64: String,
    role: String,
    is_disabled: bool,
    is_system: bool,
}

async fn load_target(state: &AppState, steam_id64: &str) -> Result<TargetUser, AppError> {
    sqlx::query_as::<_, TargetUser>(
        "SELECT id, steam_id64, role, is_disabled, is_system FROM users WHERE steam_id64 = $1",
    )
    .bind(steam_id64)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}
