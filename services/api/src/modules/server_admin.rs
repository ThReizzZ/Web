use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
    routing::{delete, get, patch, post, put},
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::AppError,
    modules::{auth::require_admin, server_plugin::STALE_AFTER_SECS},
    state::AppState,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct AdminServer {
    pub id: String,
    pub name: String,
    pub map: String,
    pub description: String,
    pub community_id: Option<String>,
    pub community: String,
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
    pub player_count: Option<i32>,
    pub last_reported_at: Option<DateTime<Utc>>,
    pub plugin_state: String,
    pub has_rcon_password: bool,
    pub last_rcon_at: Option<DateTime<Utc>>,
    pub rcon_failures: i32,
    pub pending_actions: i64,
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
#[allow(clippy::struct_excessive_bools)]
struct ServerRow {
    id: String,
    name: String,
    map: String,
    description: String,
    community_id: Option<String>,
    community: String,
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
    player_count: Option<i32>,
    last_reported_at: Option<DateTime<Utc>>,
    plugin_state: String,
    has_rcon_password: bool,
    last_rcon_at: Option<DateTime<Utc>>,
    rcon_failures: i32,
    pending_actions: i64,
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

/// Adds a server with as little as `host` and `port`. Everything else is
/// optional: the API generates the id, derives a display name and fills safe
/// defaults until the plugin reports real map/player data.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateServerRequest {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub map: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    /// Optional community group id. Groups are created separately through
    /// `/admin/server-communities` so a server cannot reference a missing group.
    #[serde(default)]
    pub community_id: Option<String>,
    /// Legacy group name sent by pages loaded before community groups existed.
    #[serde(default)]
    pub community: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    pub host: String,
    pub port: i32,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub tickrate: Option<i32>,
    #[serde(default)]
    pub max_players: Option<i32>,
    #[serde(default)]
    pub latency_ms: Option<i32>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub map_image: Option<String>,
    #[serde(default)]
    pub featured: bool,
    #[serde(default)]
    pub requires_whitelist: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateServerResponse {
    pub id: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginTokenResponse {
    pub token: Option<String>,
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
            "/admin/servers/{id}/community",
            patch(update_server_community),
        )
        .route(
            "/admin/servers/{id}/players/{steam_id64}/kick",
            post(kick_player),
        )
        .route(
            "/admin/servers/{id}/players/{steam_id64}/ban",
            post(ban_player),
        )
        .route(
            "/admin/servers/{id}/plugin-token",
            get(get_plugin_token)
                .post(rotate_plugin_token)
                .delete(clear_plugin_token),
        )
        .route(
            "/admin/servers/{id}/rcon-password",
            put(set_rcon_password).delete(clear_rcon_password),
        )
        .route("/admin/server-bans/{id}/lift", post(lift_server_ban))
}

#[allow(clippy::too_many_lines)]
async fn overview(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ServerAdminOverview>, AppError> {
    require_admin(&state, &headers).await?;
    let rows = sqlx::query_as::<_, ServerRow>(
        r"
        SELECT s.id, s.name, s.map, s.description, s.community_id,
               coalesce(c.name, '') AS community, s.status, s.host, s.port, s.region,
               s.tickrate, s.max_players, s.latency_ms, s.tags, s.map_image, s.featured,
               s.is_active, s.requires_whitelist, s.player_count, s.last_reported_at,
               CASE
                   WHEN s.plugin_token IS NULL THEN 'disabled'
                   WHEN s.last_reported_at IS NOT NULL
                        AND s.last_reported_at > now() - make_interval(secs => $1::double precision)
                       THEN 'connected'
                   ELSE 'waiting'
               END AS plugin_state,
               (s.rcon_password IS NOT NULL) AS has_rcon_password,
               s.last_rcon_at, s.rcon_failures,
               (
                   SELECT count(*) FROM server_actions a
                   WHERE a.server_id = s.id AND a.processed_at IS NULL
               ) AS pending_actions
        FROM servers s
        LEFT JOIN server_communities c ON c.id = s.community_id
        ORDER BY s.is_active DESC, s.name
        ",
    )
    .bind(f64::from(STALE_AFTER_SECS))
    .fetch_all(&state.db)
    .await?;

    let player_rows = sqlx::query_as::<_, PlayerRow>(
        r"
        SELECT server_id, steam_id64, display_name, avatar_url, connected_at, last_seen_at
        FROM server_players
        WHERE last_seen_at > now() - interval '5 minutes'
        ORDER BY connected_at, display_name
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
                community_id: row.community_id,
                community: row.community,
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
                player_count: row.player_count,
                last_reported_at: row.last_reported_at,
                plugin_state: row.plugin_state,
                has_rcon_password: row.has_rcon_password,
                last_rcon_at: row.last_rcon_at,
                rcon_failures: row.rcon_failures,
                pending_actions: row.pending_actions,
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
) -> Result<(StatusCode, Json<CreateServerResponse>), AppError> {
    require_admin(&state, &headers).await?;
    validate_server(&request)?;

    let host = request.host.trim().to_owned();
    let id = match non_empty(request.id.as_deref()) {
        Some(id) => {
            let exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM servers WHERE id = $1)",
            )
            .bind(id)
            .fetch_one(&state.db)
            .await?;
            if exists {
                return Err(AppError::Conflict);
            }
            id.to_owned()
        }
        None => format!("srv-{}", &Uuid::new_v4().simple().to_string()[..12]),
    };
    let name = non_empty(request.name.as_deref())
        .map_or_else(|| format!("{host}:{}", request.port), str::to_owned);
    let map = non_empty(request.map.as_deref()).unwrap_or("待上报");
    let description = non_empty(request.description.as_deref()).unwrap_or_default();
    let community_id = resolve_community_id(
        &state,
        non_empty(request.community_id.as_deref()),
        non_empty(request.community.as_deref()),
    )
    .await?;
    let status = non_empty(request.status.as_deref()).unwrap_or("offline");
    let region = non_empty(request.region.as_deref()).unwrap_or("未知");
    let tickrate = request.tickrate.unwrap_or(128);
    let max_players = request.max_players.unwrap_or(64);
    let map_image = non_empty(request.map_image.as_deref()).unwrap_or_default();

    sqlx::query(
        r"
        INSERT INTO servers (
            id, name, map, description, community_id, status, host, port, region,
            tickrate, max_players, latency_ms, tags, map_image, featured,
            requires_whitelist
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ",
    )
    .bind(&id)
    .bind(name)
    .bind(map)
    .bind(description)
    .bind(community_id)
    .bind(status)
    .bind(&host)
    .bind(request.port)
    .bind(region)
    .bind(tickrate)
    .bind(max_players)
    .bind(request.latency_ms)
    .bind(&request.tags)
    .bind(map_image)
    .bind(request.featured)
    .bind(request.requires_whitelist)
    .execute(&state.db)
    .await?;
    Ok((StatusCode::CREATED, Json(CreateServerResponse { id })))
}

#[utoipa::path(
    get,
    path = "/api/v1/admin/servers/{id}/plugin-token",
    tag = "admin",
    params(("id" = String, Path, description = "Server id")),
    responses(
        (status = 200, description = "Current plugin token or null", body = PluginTokenResponse),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Server not found", body = crate::errors::ErrorResponse)
    )
)]
pub async fn get_plugin_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&state, &headers).await?;
    let token =
        sqlx::query_scalar::<_, Option<String>>("SELECT plugin_token FROM servers WHERE id = $1")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;

    Ok((
        [(header::CACHE_CONTROL, "no-store")],
        Json(PluginTokenResponse { token }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/admin/servers/{id}/plugin-token",
    tag = "admin",
    params(("id" = String, Path, description = "Server id")),
    responses(
        (status = 200, description = "New plugin token", body = PluginTokenResponse),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Server not found", body = crate::errors::ErrorResponse)
    )
)]
pub async fn rotate_plugin_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&state, &headers).await?;
    let token = uuid::Uuid::new_v4().simple().to_string();
    let mut transaction = state.db.begin().await?;
    let result = sqlx::query(
        r"
        UPDATE servers
        SET plugin_token = $2,
            last_reported_at = NULL,
            status = CASE
                WHEN status = 'maintenance' THEN status
                ELSE 'offline'
            END,
            player_count = 0,
            latency_ms = NULL,
            updated_at = now()
        WHERE id = $1
        ",
    )
    .bind(&id)
    .bind(&token)
    .execute(&mut *transaction)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    sqlx::query("DELETE FROM server_players WHERE server_id = $1")
        .bind(&id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;

    Ok((
        [(header::CACHE_CONTROL, "no-store")],
        Json(PluginTokenResponse { token: Some(token) }),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/v1/admin/servers/{id}/plugin-token",
    tag = "admin",
    params(("id" = String, Path, description = "Server id")),
    responses(
        (status = 204, description = "Plugin token revoked and live snapshot cleared"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Server not found", body = crate::errors::ErrorResponse)
    )
)]
pub async fn clear_plugin_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let mut transaction = state.db.begin().await?;
    let result = sqlx::query(
        r"
        UPDATE servers
        SET plugin_token = NULL,
            last_reported_at = NULL,
            status = CASE
                WHEN status = 'maintenance' THEN status
                ELSE 'offline'
            END,
            player_count = 0,
            latency_ms = NULL,
            updated_at = now()
        WHERE id = $1
        ",
    )
    .bind(&id)
    .execute(&mut *transaction)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    sqlx::query("DELETE FROM server_players WHERE server_id = $1")
        .bind(&id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Write-only RCON credential for the optional hibernation fallback. The
/// password is never returned by any admin endpoint and is never logged.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetRconPasswordRequest {
    pub password: String,
}

#[utoipa::path(
    put,
    path = "/api/v1/admin/servers/{id}/rcon-password",
    tag = "admin",
    params(("id" = String, Path, description = "Server id")),
    request_body = SetRconPasswordRequest,
    responses(
        (status = 204, description = "RCON password stored; it is never returned"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Server not found", body = crate::errors::ErrorResponse),
        (status = 422, description = "Password is invalid", body = crate::errors::ErrorResponse)
    )
)]
async fn set_rcon_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(request): Json<SetRconPasswordRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let password = request.password;
    if password.trim().is_empty()
        || password.chars().count() > 256
        || password.chars().any(char::is_control)
    {
        return Err(AppError::Validation(
            "password must be between 1 and 256 printable characters".to_owned(),
        ));
    }

    let result = sqlx::query(
        r"
        UPDATE servers
        SET rcon_password = $2,
            last_rcon_at = NULL,
            rcon_failures = 0,
            updated_at = now()
        WHERE id = $1
        ",
    )
    .bind(&id)
    .bind(&password)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/api/v1/admin/servers/{id}/rcon-password",
    tag = "admin",
    params(("id" = String, Path, description = "Server id")),
    responses(
        (status = 204, description = "RCON password removed and hibernating status cleared"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Server not found", body = crate::errors::ErrorResponse)
    )
)]
async fn clear_rcon_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let mut transaction = state.db.begin().await?;
    let status = sqlx::query_scalar::<_, String>(
        r"
        UPDATE servers
        SET rcon_password = NULL,
            last_rcon_at = NULL,
            rcon_failures = 0,
            status = CASE
                WHEN status = 'hibernating' THEN 'offline'
                ELSE status
            END,
            player_count = CASE
                WHEN status = 'hibernating' THEN 0
                ELSE player_count
            END,
            updated_at = now()
        WHERE id = $1
        RETURNING status
        ",
    )
    .bind(&id)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or(AppError::NotFound)?;

    if status == "offline" {
        sqlx::query("DELETE FROM server_players WHERE server_id = $1")
            .bind(&id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateServerCommunityRequest {
    /// Community group id, or null/omitted to leave the server ungrouped.
    #[serde(default)]
    pub community_id: Option<String>,
    /// Legacy group name sent by pages loaded before community groups existed.
    #[serde(default)]
    pub community: Option<String>,
}

/// Accept `communityId` from current clients and the legacy group name from
/// pages that were loaded before the upgrade. Resolving the name keeps an old
/// browser from silently detaching a server when it saves its free-text label.
async fn resolve_community_id(
    state: &AppState,
    community_id: Option<&str>,
    community_name: Option<&str>,
) -> Result<Option<String>, AppError> {
    if let Some(community_id) = community_id {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM server_communities WHERE id = $1)",
        )
        .bind(community_id)
        .fetch_one(&state.db)
        .await?;
        if !exists {
            return Err(AppError::Validation(
                "communityId does not match an existing community group".to_owned(),
            ));
        }
        return Ok(Some(community_id.to_owned()));
    }
    let Some(name) = community_name else {
        return Ok(None);
    };
    let id = sqlx::query_scalar::<_, String>(
        "SELECT id FROM server_communities WHERE lower(name) = lower($1)",
    )
    .bind(name)
    .fetch_optional(&state.db)
    .await?;
    id.map(Some).ok_or_else(|| {
        AppError::Validation(
            "community does not match an existing community group; create it in 社区组管理 first"
                .to_owned(),
        )
    })
}

async fn update_server_community(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(request): Json<UpdateServerCommunityRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let community_id = resolve_community_id(
        &state,
        non_empty(request.community_id.as_deref()),
        non_empty(request.community.as_deref()),
    )
    .await?;
    let result =
        sqlx::query("UPDATE servers SET community_id = $2, updated_at = now() WHERE id = $1")
            .bind(id)
            .bind(community_id)
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
    let mut transaction = state.db.begin().await?;
    let lifted = sqlx::query_as::<_, (String, String)>(
        r"
        UPDATE server_bans
        SET lifted_at = now(), lifted_by = $2
        WHERE id = $1 AND lifted_at IS NULL
        RETURNING server_id, steam_id64
        ",
    )
    .bind(id)
    .bind(admin.id)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or(AppError::Conflict)?;

    // A kick/ban action may still be waiting for the plugin. If the admin
    // lifts the ban first, drop that queued ban so the plugin cannot apply it
    // after the unban.
    sqlx::query(
        r"
        UPDATE server_actions
        SET processed_at = COALESCE(processed_at, now())
        WHERE server_id = $1
          AND steam_id64 = $2
          AND action = 'ban'
          AND processed_at IS NULL
        ",
    )
    .bind(&lifted.0)
    .bind(&lifted.1)
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn validate_server(request: &CreateServerRequest) -> Result<(), AppError> {
    let host = request.host.trim();
    if host.is_empty()
        || host.chars().count() > 255
        || host.chars().any(|ch| ch.is_whitespace() || ch == '/')
    {
        return Err(AppError::Validation(
            "host must be a hostname or IP address without spaces or slashes".to_owned(),
        ));
    }
    if let Some(id) = non_empty(request.id.as_deref())
        && (id.chars().count() > 80
            || !id
                .chars()
                .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-'))
    {
        return Err(AppError::Validation(
            "id must use lowercase letters, numbers and hyphens".to_owned(),
        ));
    }
    if !(1..=65535).contains(&request.port) {
        return Err(AppError::Validation("port is invalid".to_owned()));
    }
    if request
        .tickrate
        .is_some_and(|value| !(1..=1000).contains(&value))
        || request
            .max_players
            .is_some_and(|value| !(1..=1024).contains(&value))
    {
        return Err(AppError::Validation(
            "tickrate or maxPlayers is invalid".to_owned(),
        ));
    }
    if let Some(status) = non_empty(request.status.as_deref())
        && !matches!(status, "online" | "maintenance" | "offline")
    {
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
