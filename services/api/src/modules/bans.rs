use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{errors::AppError, modules::auth::require_admin, state::AppState};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Ban {
    pub id: uuid::Uuid,
    pub steam_id64: String,
    pub player_name: String,
    pub avatar_url: Option<String>,
    pub reason: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
    pub lifted_at: Option<DateTime<Utc>>,
    pub lifted_by: Option<String>,
    pub lift_reason: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBanRequest {
    pub steam_id64: String,
    pub player_name: Option<String>,
    pub reason: String,
    pub expires_in_hours: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiftBanRequest {
    pub reason: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/bans", get(list_bans).post(create_ban))
        .route("/admin/bans/{id}/lift", post(lift_ban))
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

async fn list_bans(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Ban>>, AppError> {
    require_admin(&state, &headers).await?;
    let bans = sqlx::query_as::<_, Ban>(
        r"
        SELECT b.id, b.steam_id64,
               coalesce(b.player_name, u.persona_name, b.steam_id64) AS player_name,
               u.avatar_url,
               b.reason, b.expires_at, b.created_at,
               coalesce(creator.persona_name, '已删除管理员') AS created_by,
               b.lifted_at,
               lifter.persona_name AS lifted_by,
               b.lift_reason,
               (b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS is_active
        FROM bans b
        LEFT JOIN users u ON u.steam_id64 = b.steam_id64
        LEFT JOIN users creator ON creator.id = b.created_by
        LEFT JOIN users lifter ON lifter.id = b.lifted_by
        ORDER BY is_active DESC, b.created_at DESC
        ",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(bans))
}

async fn create_ban(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateBanRequest>,
) -> Result<Json<Ban>, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&request.steam_id64)?;
    if steam_id64 == admin.steam_id64 {
        return Err(AppError::bad_request("You cannot ban your own account"));
    }
    let reason = request.reason.trim();
    if reason.is_empty() || reason.chars().count() > 2000 {
        return Err(AppError::Validation(
            "reason must be between 1 and 2000 characters".to_owned(),
        ));
    }

    let target = sqlx::query_as::<_, (Option<String>, String)>(
        "SELECT persona_name, role FROM users WHERE steam_id64 = $1",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?;
    if let Some((_, role)) = &target
        && role == "admin"
    {
        return Err(AppError::Conflict);
    }

    let already_banned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM bans WHERE steam_id64 = $1 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()))",
    )
    .bind(&steam_id64)
    .fetch_one(&state.db)
    .await?;
    if already_banned {
        return Err(AppError::Conflict);
    }

    let expires_at = match request.expires_in_hours {
        Some(hours) if hours > 0 && hours <= 87_600 => Some(Utc::now() + Duration::hours(hours)),
        Some(_) => {
            return Err(AppError::Validation(
                "expiresInHours must be between 1 and 87600".to_owned(),
            ));
        }
        None => None,
    };
    let player_name = request
        .player_name
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(80).collect::<String>())
        .or_else(|| target.and_then(|(name, _)| name));

    let ban = sqlx::query_as::<_, Ban>(
        r"
        INSERT INTO bans (steam_id64, player_name, reason, expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, steam_id64, coalesce(player_name, steam_id64) AS player_name,
                  (SELECT avatar_url FROM users WHERE steam_id64 = $1) AS avatar_url,
                  reason, expires_at, created_at,
                  (SELECT persona_name FROM users WHERE id = created_by) AS created_by,
                  lifted_at, NULL::text AS lifted_by, lift_reason,
                  (lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS is_active
        ",
    )
    .bind(&steam_id64)
    .bind(player_name)
    .bind(reason)
    .bind(expires_at)
    .bind(admin.id)
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE steam_id64 = $1)",
    )
    .bind(&steam_id64)
    .execute(&state.db)
    .await?;

    Ok(Json(ban))
}

async fn lift_ban(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<uuid::Uuid>,
    Json(request): Json<LiftBanRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let reason = request
        .reason
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(500).collect::<String>());

    let result = sqlx::query(
        "UPDATE bans SET lifted_at = now(), lifted_by = $2, lift_reason = $3 WHERE id = $1 AND lifted_at IS NULL",
    )
    .bind(id)
    .bind(admin.id)
    .bind(reason)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}
