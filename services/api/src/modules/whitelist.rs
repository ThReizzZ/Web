use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, patch, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{
    errors::AppError,
    modules::auth::{AuthUser, require_admin, require_user},
    state::AppState,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WhitelistApplication {
    pub id: uuid::Uuid,
    /// `None` for applications created after the whitelist became global.
    pub server_id: Option<String>,
    pub server_name: String,
    pub steam_id64: String,
    pub player_name: String,
    pub avatar_url: Option<String>,
    pub message: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<String>,
    pub review_note: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WhitelistEntry {
    /// Always `None`: the whitelist is global. Kept for API compatibility.
    pub server_id: Option<String>,
    pub server_name: String,
    pub steam_id64: String,
    pub player_name: String,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub added_by: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ServerWhitelistSetting {
    pub id: String,
    pub name: String,
    pub requires_whitelist: bool,
    pub whitelist_count: i64,
    pub pending_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhitelistOverview {
    pub applications: Vec<WhitelistApplication>,
    pub entries: Vec<WhitelistEntry>,
    pub servers: Vec<ServerWhitelistSetting>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRequest {
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWhitelistRequest {
    /// Ignored; kept so older clients can still submit the field.
    #[serde(default)]
    pub server_id: Option<String>,
    pub steam_id64: String,
    pub player_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerWhitelistRequest {
    pub requires_whitelist: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitApplicationRequest {
    /// Ignored; the whitelist is global now.
    #[serde(default)]
    pub server_id: Option<String>,
    pub message: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/whitelist", get(overview).post(add_entry))
        .route(
            "/admin/whitelist/applications/{id}/approve",
            post(approve_application),
        )
        .route(
            "/admin/whitelist/applications/{id}/reject",
            post(reject_application),
        )
        .route("/admin/whitelist/{steam_id64}", delete(remove_entry))
        .route(
            "/admin/servers/{id}/whitelist",
            patch(update_server_whitelist),
        )
        .route("/whitelist/applications", post(submit_application))
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

async fn overview(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<WhitelistOverview>, AppError> {
    require_admin(&state, &headers).await?;

    let applications = sqlx::query_as::<_, WhitelistApplication>(
        r"
        SELECT a.id, a.server_id, coalesce(s.name, '全服') AS server_name, a.steam_id64,
               coalesce(a.player_name, u.persona_name, a.steam_id64) AS player_name,
               u.avatar_url,
               a.message, a.status, a.created_at, a.reviewed_at,
               reviewer.persona_name AS reviewed_by, a.review_note
        FROM whitelist_applications a
        LEFT JOIN servers s ON s.id = a.server_id
        LEFT JOIN users u ON u.steam_id64 = a.steam_id64
        LEFT JOIN users reviewer ON reviewer.id = a.reviewed_by
        ORDER BY (a.status = 'pending') DESC, a.created_at DESC
        ",
    )
    .fetch_all(&state.db)
    .await?;

    let entries = sqlx::query_as::<_, WhitelistEntry>(
        r"
        SELECT NULL::text AS server_id, '全服' AS server_name, w.steam_id64,
               coalesce(w.player_name, u.persona_name, w.steam_id64) AS player_name,
               u.avatar_url,
               w.created_at, adder.persona_name AS added_by
        FROM global_whitelist w
        LEFT JOIN users u ON u.steam_id64 = w.steam_id64
        LEFT JOIN users adder ON adder.id = w.added_by
        ORDER BY w.created_at DESC
        ",
    )
    .fetch_all(&state.db)
    .await?;

    let servers = sqlx::query_as::<_, ServerWhitelistSetting>(
        r"
        SELECT s.id, s.name, s.requires_whitelist,
               (SELECT count(*) FROM global_whitelist)::bigint AS whitelist_count,
               (SELECT count(*) FROM whitelist_applications
                WHERE status = 'pending')::bigint AS pending_count
        FROM servers s
        WHERE s.is_active = true
        ORDER BY s.sort_order, s.name
        ",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(WhitelistOverview {
        applications,
        entries,
        servers,
    }))
}

async fn add_entry(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<AddWhitelistRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&request.steam_id64)?;
    let player_name = request
        .player_name
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(80).collect::<String>());

    sqlx::query(
        r"
        INSERT INTO global_whitelist (steam_id64, player_name, added_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (steam_id64) DO UPDATE SET
            player_name = coalesce(EXCLUDED.player_name, global_whitelist.player_name),
            added_by = EXCLUDED.added_by
        ",
    )
    .bind(&steam_id64)
    .bind(player_name)
    .bind(admin.id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn approve_application(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<uuid::Uuid>,
    Json(request): Json<ReviewRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let note = request
        .note
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(500).collect::<String>());

    let application = sqlx::query_as::<_, (Option<String>, String, Option<String>, String)>(
        "SELECT server_id, steam_id64, player_name, status FROM whitelist_applications WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    if application.3 != "pending" {
        return Err(AppError::Conflict);
    }

    let mut transaction = state.db.begin().await?;
    let updated = sqlx::query(
        "UPDATE whitelist_applications SET status = 'approved', reviewed_by = $2, reviewed_at = now(), review_note = $3 WHERE id = $1 AND status = 'pending'",
    )
    .bind(id)
    .bind(admin.id)
    .bind(note)
    .execute(&mut *transaction)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    sqlx::query(
        r"
        INSERT INTO global_whitelist (steam_id64, player_name, added_by, source_application_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (steam_id64) DO UPDATE SET
            player_name = coalesce(EXCLUDED.player_name, global_whitelist.player_name),
            added_by = EXCLUDED.added_by,
            source_application_id = EXCLUDED.source_application_id
        ",
    )
    .bind(&application.1)
    .bind(&application.2)
    .bind(admin.id)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn reject_application(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<uuid::Uuid>,
    Json(request): Json<ReviewRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let note = request
        .note
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(500).collect::<String>());

    let result = sqlx::query(
        "UPDATE whitelist_applications SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = $3 WHERE id = $1 AND status = 'pending'",
    )
    .bind(id)
    .bind(admin.id)
    .bind(note)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn remove_entry(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(steam_id64): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&steam_id64)?;
    let result = sqlx::query("DELETE FROM global_whitelist WHERE steam_id64 = $1")
        .bind(steam_id64)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn update_server_whitelist(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(request): Json<ServerWhitelistRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result = sqlx::query(
        "UPDATE servers SET requires_whitelist = $2, updated_at = now() WHERE id = $1 AND is_active = true",
    )
    .bind(id)
    .bind(request.requires_whitelist)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn submit_application(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<SubmitApplicationRequest>,
) -> Result<StatusCode, AppError> {
    let user = require_user(&state, &headers).await?;
    submit_application_for_user(&state, &user, request).await
}

async fn submit_application_for_user(
    state: &AppState,
    user: &AuthUser,
    request: SubmitApplicationRequest,
) -> Result<StatusCode, AppError> {
    let message = request.message.trim();
    if message.is_empty() || message.chars().count() > 2000 {
        return Err(AppError::Validation(
            "message must be between 1 and 2000 characters".to_owned(),
        ));
    }

    let already_whitelisted = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM global_whitelist WHERE steam_id64 = $1)",
    )
    .bind(&user.steam_id64)
    .fetch_one(&state.db)
    .await?;
    if already_whitelisted {
        return Err(AppError::Conflict);
    }
    let pending = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM whitelist_applications WHERE steam_id64 = $1 AND status = 'pending')",
    )
    .bind(&user.steam_id64)
    .fetch_one(&state.db)
    .await?;
    if pending {
        return Err(AppError::Conflict);
    }

    let result = sqlx::query(
        r"
        INSERT INTO whitelist_applications (server_id, steam_id64, player_name, message)
        VALUES (NULL, $1, $2, $3)
        ON CONFLICT DO NOTHING
        ",
    )
    .bind(&user.steam_id64)
    .bind(&user.persona_name)
    .bind(message)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }

    Ok(StatusCode::NO_CONTENT)
}
