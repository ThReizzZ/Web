use std::net::IpAddr;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{
    errors::AppError,
    modules::auth::{client_ip, require_admin},
    state::AppState,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Ban {
    pub id: uuid::Uuid,
    pub ban_type: String,
    pub steam_id64: Option<String>,
    pub ip_address: Option<String>,
    pub source_ban_id: Option<uuid::Uuid>,
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
    /// `steam` (default) or `ip`.
    #[serde(default)]
    pub ban_type: Option<String>,
    #[serde(default)]
    pub steam_id64: Option<String>,
    #[serde(default)]
    pub ip_address: Option<String>,
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

fn validate_steam_id(value: Option<&str>) -> Result<String, AppError> {
    let value = value.unwrap_or_default().trim();
    if value.len() != 17 || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(AppError::Validation(
            "steamId64 must be a 17-digit number".to_owned(),
        ));
    }
    Ok(value.to_owned())
}

fn validate_ip(value: Option<&str>) -> Result<String, AppError> {
    let value = value.unwrap_or_default().trim();
    let parsed: IpAddr = value.parse().map_err(|_| {
        AppError::Validation("ipAddress must be a valid IPv4 or IPv6 address".to_owned())
    })?;
    Ok(parsed.to_string())
}

fn validate_reason(value: &str) -> Result<String, AppError> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 2000 {
        return Err(AppError::Validation(
            "reason must be between 1 and 2000 characters".to_owned(),
        ));
    }
    Ok(value.to_owned())
}

fn validate_expiry(hours: Option<i64>) -> Result<Option<DateTime<Utc>>, AppError> {
    match hours {
        Some(hours) if hours > 0 && hours <= 87_600 => {
            Ok(Some(Utc::now() + Duration::hours(hours)))
        }
        Some(_) => Err(AppError::Validation(
            "expiresInHours must be between 1 and 87600".to_owned(),
        )),
        None => Ok(None),
    }
}

/// Creates an IP ban and bans the known non-admin accounts that used the IP.
///
/// Returns `None` when an active ban for the same IP already exists. Callers
/// use this for manually created IP bans and for bans that should be mirrored
/// to the player's last known IP automatically.
#[allow(clippy::too_many_lines)]
pub(crate) async fn create_ip_ban(
    db: &sqlx::PgPool,
    created_by: Option<uuid::Uuid>,
    ip: &str,
    player_name: Option<&str>,
    reason: &str,
    expires_at: Option<DateTime<Utc>>,
) -> Result<Option<uuid::Uuid>, AppError> {
    let parsed: IpAddr = ip.parse().map_err(|_| {
        AppError::Validation("ipAddress must be a valid IPv4 or IPv6 address".to_owned())
    })?;
    let ip = parsed.to_string();
    let player_name = player_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map_or_else(|| ip.clone(), |value| value.chars().take(80).collect());
    let reason: String = reason.chars().take(2000).collect();

    let already_banned = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS (
            SELECT 1 FROM bans
            WHERE ban_type = 'ip'
              AND ip_address = $1
              AND lifted_at IS NULL
              AND (expires_at IS NULL OR expires_at > now())
        )
        ",
    )
    .bind(&ip)
    .fetch_one(db)
    .await?;
    if already_banned {
        return Ok(None);
    }

    let linked_reason: String = format!("IP 封禁自动关联：{reason}")
        .chars()
        .take(2000)
        .collect();

    let mut transaction = db.begin().await?;
    let ban_id = sqlx::query_scalar::<_, uuid::Uuid>(
        r"
        INSERT INTO bans (ban_type, ip_address, player_name, reason, expires_at, created_by)
        VALUES ('ip', $1, $2, $3, $4, $5)
        RETURNING id
        ",
    )
    .bind(&ip)
    .bind(&player_name)
    .bind(&reason)
    .bind(expires_at)
    .bind(created_by)
    .fetch_one(&mut *transaction)
    .await?;

    // Automatically ban known member accounts that used this IP.
    sqlx::query(
        r"
        INSERT INTO bans (
            ban_type, steam_id64, player_name, reason, expires_at,
            created_by, source_ban_id
        )
        SELECT 'steam', u.steam_id64, u.persona_name, $2, $3, $4, $5
        FROM users u
        WHERE u.role <> 'admin'
          AND (
              u.last_login_ip = $1
              OR EXISTS (
                  SELECT 1 FROM sessions s
                  WHERE s.user_id = u.id
                    AND s.ip_address = $1
                    AND s.expires_at > now()
              )
          )
          AND NOT EXISTS (
              SELECT 1 FROM bans b
              WHERE b.ban_type = 'steam'
                AND b.steam_id64 = u.steam_id64
                AND b.lifted_at IS NULL
                AND (b.expires_at IS NULL OR b.expires_at > now())
          )
        ",
    )
    .bind(&ip)
    .bind(&linked_reason)
    .bind(expires_at)
    .bind(created_by)
    .bind(ban_id)
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r"
        DELETE FROM sessions
        WHERE user_id IN (
            SELECT u.id
            FROM users u
            WHERE u.role <> 'admin'
              AND (
                  u.last_login_ip = $1
                  OR EXISTS (
                      SELECT 1 FROM sessions s
                      WHERE s.user_id = u.id
                        AND s.ip_address = $1
                        AND s.expires_at > now()
                  )
              )
        )
        ",
    )
    .bind(&ip)
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;
    Ok(Some(ban_id))
}

async fn fetch_ban(db: &sqlx::PgPool, id: uuid::Uuid) -> Result<Ban, AppError> {
    let ban = sqlx::query_as::<_, Ban>(
        r"
        SELECT b.id, b.ban_type, b.steam_id64, b.ip_address, b.source_ban_id,
               coalesce(b.player_name, u.persona_name, b.ip_address, 'IP 封禁') AS player_name,
               u.avatar_url, b.reason, b.expires_at, b.created_at,
               coalesce(creator.persona_name, '系统') AS created_by,
               b.lifted_at, lifter.persona_name AS lifted_by, b.lift_reason,
               (b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS is_active
        FROM bans b
        LEFT JOIN users u ON u.steam_id64 = b.steam_id64
        LEFT JOIN users creator ON creator.id = b.created_by
        LEFT JOIN users lifter ON lifter.id = b.lifted_by
        WHERE b.id = $1
        ",
    )
    .bind(id)
    .fetch_one(db)
    .await?;
    Ok(ban)
}

async fn list_bans(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Ban>>, AppError> {
    require_admin(&state, &headers).await?;
    let bans = sqlx::query_as::<_, Ban>(
        r"
        SELECT b.id, b.ban_type, b.steam_id64, b.ip_address, b.source_ban_id,
               coalesce(b.player_name, u.persona_name, b.ip_address, 'IP 封禁') AS player_name,
               u.avatar_url, b.reason, b.expires_at, b.created_at,
               coalesce(creator.persona_name, '系统') AS created_by,
               b.lifted_at, lifter.persona_name AS lifted_by, b.lift_reason,
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

#[allow(clippy::too_many_lines)]
async fn create_ban(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateBanRequest>,
) -> Result<Json<Ban>, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let reason = validate_reason(&request.reason)?;
    let expires_at = validate_expiry(request.expires_in_hours)?;
    let ban_type = request.ban_type.as_deref().unwrap_or("steam");

    match ban_type {
        "steam" => {
            let steam_id64 = validate_steam_id(request.steam_id64.as_deref())?;
            if steam_id64 == admin.steam_id64 {
                return Err(AppError::bad_request("You cannot ban your own account"));
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
                r"
                SELECT EXISTS (
                    SELECT 1 FROM bans
                    WHERE ban_type = 'steam'
                      AND steam_id64 = $1
                      AND lifted_at IS NULL
                      AND (expires_at IS NULL OR expires_at > now())
                )
                ",
            )
            .bind(&steam_id64)
            .fetch_one(&state.db)
            .await?;
            if already_banned {
                return Err(AppError::Conflict);
            }

            let player_name = request
                .player_name
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
                .map(|value| value.chars().take(80).collect::<String>())
                .or_else(|| target.and_then(|(name, _)| name));

            let ban_id = sqlx::query_scalar::<_, uuid::Uuid>(
                r"
                INSERT INTO bans (ban_type, steam_id64, player_name, reason, expires_at, created_by)
                VALUES ('steam', $1, $2, $3, $4, $5)
                RETURNING id
                ",
            )
            .bind(&steam_id64)
            .bind(player_name)
            .bind(&reason)
            .bind(expires_at)
            .bind(admin.id)
            .fetch_one(&state.db)
            .await?;

            // Mirror the account ban to the player's last known IP. Look up the
            // IP before deleting sessions so an active session IP is still
            // available; the helper skips an already active IP ban.
            let known_ip = sqlx::query_scalar::<_, Option<String>>(
                r"
                SELECT coalesce(
                    (SELECT u.last_login_ip FROM users u WHERE u.steam_id64 = $1),
                    (
                        SELECT s.ip_address
                        FROM sessions s
                        JOIN users u ON u.id = s.user_id
                        WHERE u.steam_id64 = $1
                          AND s.ip_address IS NOT NULL
                          AND s.expires_at > now()
                        ORDER BY s.created_at DESC
                        LIMIT 1
                    ),
                    (
                        SELECT p.ip_address
                        FROM server_players p
                        WHERE p.steam_id64 = $1
                          AND p.ip_address IS NOT NULL
                        ORDER BY p.last_seen_at DESC
                        LIMIT 1
                    )
                )
                ",
            )
            .bind(&steam_id64)
            .fetch_one(&state.db)
            .await?;

            sqlx::query(
                "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE steam_id64 = $1)",
            )
            .bind(&steam_id64)
            .execute(&state.db)
            .await?;

            if let Some(ip) = known_ip
                && client_ip(&headers).as_deref() != Some(ip.as_str())
            {
                let auto_reason: String = format!("账号封禁自动关联 IP：{reason}")
                    .chars()
                    .take(2000)
                    .collect();
                if let Err(error) = create_ip_ban(
                    &state.db,
                    Some(admin.id),
                    &ip,
                    None,
                    &auto_reason,
                    expires_at,
                )
                .await
                {
                    tracing::warn!(%error, %steam_id64, "failed to auto-create IP ban");
                }
            }

            Ok(Json(fetch_ban(&state.db, ban_id).await?))
        }
        "ip" => {
            let ip = validate_ip(request.ip_address.as_deref())?;
            if client_ip(&headers).as_deref() == Some(ip.as_str()) {
                return Err(AppError::bad_request("You cannot ban your own current IP"));
            }

            let already_banned = sqlx::query_scalar::<_, bool>(
                r"
                SELECT EXISTS (
                    SELECT 1 FROM bans
                    WHERE ban_type = 'ip'
                      AND ip_address = $1
                      AND lifted_at IS NULL
                      AND (expires_at IS NULL OR expires_at > now())
                )
                ",
            )
            .bind(&ip)
            .fetch_one(&state.db)
            .await?;
            if already_banned {
                return Err(AppError::Conflict);
            }

            let ban_id = create_ip_ban(
                &state.db,
                Some(admin.id),
                &ip,
                request.player_name.as_deref(),
                &reason,
                expires_at,
            )
            .await?
            .ok_or(AppError::Conflict)?;
            Ok(Json(fetch_ban(&state.db, ban_id).await?))
        }
        _ => Err(AppError::Validation(
            "banType must be \"steam\" or \"ip\"".to_owned(),
        )),
    }
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

    let mut transaction = state.db.begin().await?;
    let ban_type = sqlx::query_scalar::<_, String>(
        r"
        UPDATE bans
        SET lifted_at = now(), lifted_by = $2, lift_reason = $3
        WHERE id = $1 AND lifted_at IS NULL
        RETURNING ban_type
        ",
    )
    .bind(id)
    .bind(admin.id)
    .bind(&reason)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or(AppError::Conflict)?;

    if ban_type == "ip" {
        // Lifting an IP ban also lifts the account bans it created, so the
        // affected members can sign in again.
        sqlx::query(
            r"
            UPDATE bans
            SET lifted_at = now(), lifted_by = $2,
                lift_reason = coalesce($3, '源 IP 封禁已解除')
            WHERE source_ban_id = $1 AND lifted_at IS NULL
            ",
        )
        .bind(id)
        .bind(admin.id)
        .bind(&reason)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
