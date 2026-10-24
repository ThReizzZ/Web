use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post},
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{errors::AppError, modules::auth::require_admin, state::AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminServer {
    pub id: String,
    pub name: String,
    pub map: String,
    pub description: String,
    pub status: String,
    pub host: String,
    pub port: i32,
    pub region: String,
    pub tickrate: i32,
    pub max_players: i32,
    pub latency_ms: Option<i32>,
    pub tags: Vec<String>,
    pub map_image: String,
    pub featured: bool,
    pub is_active: bool,
    pub requires_whitelist: bool,
    pub players: Vec<AdminPlayer>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminPlayer {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub connected_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ServerBan {
    pub id: uuid::Uuid,
    pub server_id: String,
    pub server_name: String,
    pub steam_id64: String,
    pub player_name: String,
    pub avatar_url: Option<String>,
    pub reason: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
    pub lifted_at: Option<DateTime<Utc>>,
    pub lifted_by: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerAdminOverview {
    pub servers: Vec<AdminServer>,
    pub bans: Vec<ServerBan>,
}

#[derive(Debug, FromRow)]
struct ServerRow {
    id: String,
    name: String,
    map: String,
    description: String,
    status: String,
    host: String,
    port: i32,
    region: String,
    tickrate: i32,
    max_players: i32,
    latency_ms: Option<i32>,
    tags: Vec<String>,
    map_image: String,
    featured: bool,
    is_active: bool,
    requires_whitelist: bool,
}

#[derive(Debug, FromRow)]
struct PlayerRow {
    server_id: String,
    steam_id64: String,
    display_name: String,
    avatar_url: Option<String>,
    connected_at: DateTime<Utc>,
    last_seen_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateServerRequest {
    pub id: String,
    pub name: String,
    pub map: String,
    pub description: String,
    pub status: String,
    pub host: String,
    pub port: i32,
    pub region: String,
    pub tickrate: i32,
    pub max_players: i32,
    pub latency_ms: Option<i32>,
    pub tags: Vec<String>,
    pub map_image: String,
    pub featured: bool,
    pub requires_whitelist: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KickRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerBanRequest {
    pub reason: String,
    pub expires_in_hours: Option<i64>,
    pub player_name: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/servers", get(overview).post(create_server))
        .route(
            "/admin/servers/{id}",
            delete(delete_server).patch(update_server_active),
        )
        .route(
            "/admin/servers/{id}/players/{steam_id64}/kick",
            post(kick_player),
        )
        .route(
            "/admin/servers/{id}/players/{steam_id64}/ban",
            post(ban_player),
        )
        .route("/admin/server-bans/{id}/lift", post(lift_server_ban))
}

async fn overview(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ServerAdminOverview>, AppError> {
    require_admin(&state, &headers).await?;
    let rows = sqlx::query_as::<_, ServerRow>(
        r"
        SELECT id, name, map, description, status, host, port, region, tickrate,
               max_players, latency_ms, tags, map_image, featured, is_active, requires_whitelist
        FROM servers
        ORDER BY is_active DESC, name
        ",
    )
    .fetch_all(&state.db)
    .await?;

    let player_rows = sqlx::query_as::<_, PlayerRow>(
        r"
        SELECT server_id, steam_id64, display_name, avatar_url, connected_at, last_seen_at
        FROM server_players
        WHERE last_seen_at > now() - interval '5 minutes'
        ORDER BY connected_at
        ",
    )
    .fetch_all(&state.db)
    .await?;

    let servers = rows
        .into_iter()
        .map(|row| {
            let players = player_rows
                .iter()
                .filter(|player| player.server_id == row.id)
                .map(|player| AdminPlayer {
                    steam_id64: player.steam_id64.clone(),
                    name: player.display_name.clone(),
                    avatar_url: player.avatar_url.clone(),
                    connected_at: player.connected_at,
                    last_seen_at: player.last_seen_at,
                })
                .collect();
            AdminServer {
                id: row.id,
                name: row.name,
                map: row.map,
                description: row.description,
                status: row.status,
                host: row.host,
                port: row.port,
                region: row.region,
                tickrate: row.tickrate,
                max_players: row.max_players,
                latency_ms: row.latency_ms,
                tags: row.tags,
                map_image: row.map_image,
                featured: row.featured,
                is_active: row.is_active,
                requires_whitelist: row.requires_whitelist,
                players,
            }
        })
        .collect();

    let bans = sqlx::query_as::<_, ServerBan>(
        r"
        SELECT b.id, b.server_id, s.name AS server_name, b.steam_id64,
               coalesce(b.player_name, u.persona_name, b.steam_id64) AS player_name,
               u.avatar_url, b.reason, b.expires_at, b.created_at,
               coalesce(creator.persona_name, '已删除管理员') AS created_by,
               b.lifted_at, lifter.persona_name AS lifted_by,
               (b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS is_active
        FROM server_bans b
        JOIN servers s ON s.id = b.server_id
        LEFT JOIN users u ON u.steam_id64 = b.steam_id64
        LEFT JOIN users creator ON creator.id = b.created_by
        LEFT JOIN users lifter ON lifter.id = b.lifted_by
        ORDER BY is_active DESC, b.created_at DESC
        LIMIT 200
        ",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ServerAdminOverview { servers, bans }))
}

async fn create_server(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateServerRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    validate_server(&request)?;
    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM servers WHERE id = $1)")
            .bind(&request.id)
            .fetch_one(&state.db)
            .await?;
    if exists {
        return Err(AppError::Conflict);
    }
    sqlx::query(
        r"
        INSERT INTO servers (
            id, name, map, description, status, host, port, region, tickrate,
            max_players, latency_ms, tags, map_image, featured, requires_whitelist
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ",
    )
    .bind(&request.id)
    .bind(request.name.trim())
    .bind(request.map.trim())
    .bind(request.description.trim())
    .bind(&request.status)
    .bind(request.host.trim())
    .bind(request.port)
    .bind(request.region.trim())
    .bind(request.tickrate)
    .bind(request.max_players)
    .bind(request.latency_ms)
    .bind(&request.tags)
    .bind(request.map_image.trim())
    .bind(request.featured)
    .bind(request.requires_whitelist)
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateServerRequest {
    pub is_active: bool,
}

async fn update_server_active(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(request): Json<UpdateServerRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result = sqlx::query("UPDATE servers SET is_active = $2, updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(request.is_active)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_server(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result = sqlx::query("DELETE FROM servers WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn kick_player(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((server_id, steam_id64)): Path<(String, String)>,
    Json(request): Json<KickRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    validate_steam_id(&steam_id64)?;
    let reason = validate_reason(&request.reason)?;
    let target = sqlx::query_as::<_, (String,)>(
        "SELECT display_name FROM server_players WHERE server_id = $1 AND steam_id64 = $2",
    )
    .bind(&server_id)
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    let _ = target;
    sqlx::query(
        "INSERT INTO server_actions (server_id, steam_id64, action, reason, created_by) VALUES ($1,$2,'kick',$3,$4)",
    )
    .bind(&server_id)
    .bind(&steam_id64)
    .bind(&reason)
    .bind(admin.id)
    .execute(&state.db)
    .await?;
    sqlx::query("DELETE FROM server_players WHERE server_id = $1 AND steam_id64 = $2")
        .bind(server_id)
        .bind(steam_id64)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn ban_player(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((server_id, steam_id64)): Path<(String, String)>,
    Json(request): Json<ServerBanRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    validate_steam_id(&steam_id64)?;
    let reason = validate_reason(&request.reason)?;
    let player_name = request
        .player_name
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let server_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM servers WHERE id = $1 AND is_active = true)",
    )
    .bind(&server_id)
    .fetch_one(&state.db)
    .await?;
    if !server_exists {
        return Err(AppError::NotFound);
    }
    let already_banned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM server_bans WHERE server_id = $1 AND steam_id64 = $2 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()))",
    )
    .bind(&server_id)
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

    let mut transaction = state.db.begin().await?;
    sqlx::query(
        "INSERT INTO server_bans (server_id, steam_id64, player_name, reason, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6)",
    )
    .bind(&server_id)
    .bind(&steam_id64)
    .bind(player_name)
    .bind(&reason)
    .bind(expires_at)
    .bind(admin.id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        "INSERT INTO server_actions (server_id, steam_id64, action, reason, created_by) VALUES ($1,$2,'ban',$3,$4)",
    )
    .bind(&server_id)
    .bind(&steam_id64)
    .bind(&reason)
    .bind(admin.id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM server_players WHERE server_id = $1 AND steam_id64 = $2")
        .bind(&server_id)
        .bind(&steam_id64)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn lift_server_ban(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<uuid::Uuid>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let result = sqlx::query(
        "UPDATE server_bans SET lifted_at = now(), lifted_by = $2 WHERE id = $1 AND lifted_at IS NULL",
    )
    .bind(id)
    .bind(admin.id)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}

fn validate_server(request: &CreateServerRequest) -> Result<(), AppError> {
    if request.id.len() > 80
        || request.id.is_empty()
        || !request
            .id
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
    {
        return Err(AppError::Validation(
            "id must use lowercase letters, numbers and hyphens".to_owned(),
        ));
    }
    if request.name.trim().is_empty()
        || request.map.trim().is_empty()
        || request.host.trim().is_empty()
    {
        return Err(AppError::Validation(
            "name, map and host are required".to_owned(),
        ));
    }
    if !(1..=65535).contains(&request.port) {
        return Err(AppError::Validation("port is invalid".to_owned()));
    }
    if !(1..=1000).contains(&request.tickrate) || !(1..=1024).contains(&request.max_players) {
        return Err(AppError::Validation(
            "tickrate or maxPlayers is invalid".to_owned(),
        ));
    }
    if !matches!(
        request.status.as_str(),
        "online" | "maintenance" | "offline"
    ) {
        return Err(AppError::Validation("status is invalid".to_owned()));
    }
    Ok(())
}

fn validate_steam_id(value: &str) -> Result<(), AppError> {
    if value.len() != 17 || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(AppError::Validation(
            "steamId64 must be a 17-digit number".to_owned(),
        ));
    }
    Ok(())
}

fn validate_reason(value: &str) -> Result<String, AppError> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 1000 {
        return Err(AppError::Validation(
            "reason must be between 1 and 1000 characters".to_owned(),
        ));
    }
    Ok(value.to_owned())
}
