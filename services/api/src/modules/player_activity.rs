//! Admin-only player access monitoring and player detail aggregation.
//!
//! The plugin reports rejected connection attempts. Successful joins are
//! derived from the roster report, which also maintains
//! `server_player_sessions`. This module exposes the admin list/filter API and
//! the aggregated player profile used by the "进服监控" and "玩家详情" pages.

use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
};

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, put},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::AppError,
    modules::{
        auth::require_admin,
        players::parse_steam_identifier,
        server_plugin::{ACCESS_METHODS, FAILURE_CODES},
    },
    state::AppState,
};

const DEFAULT_PAGE_SIZE: i64 = 30;
const MAX_PAGE_SIZE: i64 = 100;
const MAX_SEARCH_CHARS: usize = 100;
const MAX_NOTE_CHARS: usize = 4000;
const MAX_TAGS: usize = 10;
const MAX_TAG_CHARS: usize = 32;

#[derive(Debug, Deserialize)]
pub struct AccessLogQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub steam_id64: Option<String>,
    pub server_id: Option<String>,
    pub ip_address: Option<String>,
    pub allowed: Option<bool>,
    pub access_method: Option<String>,
    pub failure_code: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccessLogItem {
    pub id: Uuid,
    pub server_id: String,
    pub server_name: String,
    pub server_port: i32,
    pub community_name: Option<String>,
    pub steam_id64: String,
    pub player_name: String,
    pub ip_address: Option<String>,
    pub allowed: bool,
    pub access_method: String,
    pub failure_code: Option<String>,
    pub reject_reason: Option<String>,
    pub rating: Option<i32>,
    pub steam_level: Option<i32>,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessLogPage {
    pub items: Vec<AccessLogItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Deserialize)]
pub struct PlayerSearchQuery {
    pub q: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlayerCandidate {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub online: bool,
    pub last_seen_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct PlayerDetailQuery {
    #[serde(alias = "steamId", alias = "steamid", alias = "steam")]
    pub steam_input: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDetailProfile {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub bio: String,
    pub location: String,
    pub is_disabled: bool,
    pub registered_at: Option<DateTime<Utc>>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub first_seen_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub online: bool,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlayerOnlineServer {
    pub id: String,
    pub name: String,
    pub map: String,
    pub connected_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSessionItem {
    pub id: Uuid,
    pub server_id: String,
    pub server_name: String,
    pub player_name: String,
    pub ip_address: Option<String>,
    pub joined_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub left_at: Option<DateTime<Utc>>,
    pub leave_reason: Option<String>,
    pub duration_seconds: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlayerGameBanItem {
    pub id: Uuid,
    pub scope: String,
    pub server_name: String,
    pub reason: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub lifted_at: Option<DateTime<Utc>>,
    pub created_by: String,
    pub lifted_by: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlayerIpBanItem {
    pub id: Uuid,
    pub ip_address: String,
    pub reason: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub lifted_at: Option<DateTime<Utc>>,
    pub created_by: String,
    pub lifted_by: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlayerWhitelistApplicationItem {
    pub id: Uuid,
    pub status: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<String>,
    pub review_note: Option<String>,
    pub server_name: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlayerWhitelistEntryItem {
    pub server_name: String,
    pub created_at: DateTime<Utc>,
    pub added_by: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct LinkedAccount {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub last_seen_at: DateTime<Utc>,
    pub online: bool,
    pub has_active_ban: bool,
    pub has_active_ip_ban: bool,
    pub has_whitelist: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerIpGroup {
    pub ip_address: String,
    pub first_seen_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub access_count: i64,
    pub linked_accounts: Vec<LinkedAccount>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDetailStats {
    pub access_success: i64,
    pub access_failure: i64,
    pub active_ban_count: i64,
    pub known_ip_count: i64,
    pub linked_account_count: i64,
    pub total_play_seconds: i64,
    pub session_count: i64,
    pub topics: i64,
    pub replies: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEvent {
    pub id: String,
    pub kind: String,
    pub occurred_at: DateTime<Utc>,
    pub title: String,
    pub description: String,
    pub actor: Option<String>,
    pub server_name: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct NoteHistoryItem {
    pub id: Uuid,
    pub note: String,
    pub tags: Vec<String>,
    pub changed_at: DateTime<Utc>,
    pub changed_by: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerInternalProfile {
    pub note: String,
    pub tags: Vec<String>,
    pub updated_at: Option<DateTime<Utc>>,
    pub updated_by: Option<String>,
    pub history: Vec<NoteHistoryItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDetail {
    pub profile: PlayerDetailProfile,
    pub online_servers: Vec<PlayerOnlineServer>,
    pub stats: PlayerDetailStats,
    pub access_logs: Vec<AccessLogItem>,
    pub sessions: Vec<PlayerSessionItem>,
    pub game_bans: Vec<PlayerGameBanItem>,
    pub ip_bans: Vec<PlayerIpBanItem>,
    pub whitelist_applications: Vec<PlayerWhitelistApplicationItem>,
    pub whitelist_entries: Vec<PlayerWhitelistEntryItem>,
    pub ip_groups: Vec<PlayerIpGroup>,
    pub timeline: Vec<TimelineEvent>,
    pub timeline_total: i64,
    pub internal_profile: PlayerInternalProfile,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlayerProfileRequest {
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, FromRow)]
struct UserProfileRow {
    persona_name: String,
    avatar_url: Option<String>,
    role: String,
    bio: String,
    location: String,
    is_disabled: bool,
    created_at: DateTime<Utc>,
    last_login_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct LatestRosterRow {
    display_name: String,
    avatar_url: Option<String>,
}

#[derive(Debug, FromRow)]
struct LatestAccessRow {
    player_name: String,
}

#[derive(Debug, FromRow)]
struct LatestSessionRow {
    player_name: String,
}

#[derive(Debug, FromRow)]
struct LatestBanNameRow {
    player_name: String,
}

#[derive(Debug, FromRow)]
struct KnownIpRow {
    ip_address: String,
    first_seen_at: DateTime<Utc>,
    last_seen_at: DateTime<Utc>,
    access_count: i64,
}

#[derive(Debug, FromRow)]
#[allow(clippy::struct_excessive_bools)]
struct LinkedAccountRow {
    ip_address: String,
    steam_id64: String,
    name: String,
    avatar_url: Option<String>,
    last_seen_at: DateTime<Utc>,
    online: bool,
    has_active_ban: bool,
    has_active_ip_ban: bool,
    has_whitelist: bool,
}

#[derive(Debug, FromRow)]
struct ForumEventRow {
    kind: String,
    id: String,
    title: String,
    description: String,
    occurred_at: DateTime<Utc>,
    server_name: Option<String>,
}

#[derive(Debug, FromRow)]
struct InternalProfileRow {
    note: String,
    tags: Vec<String>,
    updated_at: DateTime<Utc>,
    updated_by: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/access-logs", get(list_access_logs))
        .route("/admin/player-detail/search", get(search_player_detail))
        .route("/admin/player-detail", get(get_player_detail))
        .route(
            "/admin/player-detail/{steam_id64}/profile",
            put(update_player_profile),
        )
}

#[utoipa::path(
    get,
    path = "/api/v1/admin/access-logs",
    tag = "admin",
    responses(
        (status = 200, description = "Paginated player access attempts"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse)
    )
)]
#[allow(clippy::too_many_lines)]
pub async fn list_access_logs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AccessLogQuery>,
) -> Result<Json<AccessLogPage>, AppError> {
    require_admin(&state, &headers).await?;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query
        .page_size
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .clamp(1, MAX_PAGE_SIZE);
    let offset = (page - 1).saturating_mul(page_size);

    let steam_id64 = optional_trim(query.steam_id64.as_deref());
    if let Some(value) = steam_id64.as_deref()
        && !is_steam_id64(value)
    {
        return Err(AppError::Validation(
            "steamId64 must be a 17-digit number".to_owned(),
        ));
    }
    let server_id = optional_trim(query.server_id.as_deref());
    let ip_address = optional_trim(query.ip_address.as_deref())
        .map(|value| canonical_ip(&value))
        .transpose()?;
    let access_method = optional_trim(query.access_method.as_deref());
    if let Some(value) = access_method.as_deref()
        && !ACCESS_METHODS.contains(&value)
    {
        return Err(AppError::Validation(
            "accessMethod is not a supported access method".to_owned(),
        ));
    }
    let failure_code = optional_trim(query.failure_code.as_deref());
    if let Some(value) = failure_code.as_deref()
        && !FAILURE_CODES.contains(&value)
    {
        return Err(AppError::Validation(
            "failureCode is not a supported failure code".to_owned(),
        ));
    }
    let search = optional_trim(query.search.as_deref()).map(|value| {
        let value = value.chars().take(MAX_SEARCH_CHARS).collect::<String>();
        format!("%{value}%")
    });

    let total = sqlx::query_scalar::<_, i64>(
        r"
        SELECT count(*)::bigint
        FROM server_access_logs l
        JOIN servers s ON s.id = l.server_id
        WHERE ($1::text IS NULL OR l.steam_id64 = $1)
          AND ($2::text IS NULL OR l.server_id = $2)
          AND ($3::text IS NULL OR l.ip_address = $3)
          AND ($4::bool IS NULL OR l.allowed = $4)
          AND ($5::text IS NULL OR l.access_method = $5)
          AND ($6::text IS NULL OR l.failure_code = $6)
          AND (
              $7::text IS NULL
              OR l.player_name ILIKE $7
              OR l.steam_id64 ILIKE $7
              OR s.name ILIKE $7
          )
        ",
    )
    .bind(&steam_id64)
    .bind(&server_id)
    .bind(&ip_address)
    .bind(query.allowed)
    .bind(&access_method)
    .bind(&failure_code)
    .bind(&search)
    .fetch_one(&state.db)
    .await?;

    let items = sqlx::query_as::<_, AccessLogItem>(
        r"
        SELECT l.id, l.server_id, s.name AS server_name, s.port AS server_port,
               c.name AS community_name, l.steam_id64, l.player_name,
               l.ip_address, l.allowed, l.access_method, l.failure_code,
               l.reject_reason, l.rating, l.steam_level, l.occurred_at
        FROM server_access_logs l
        JOIN servers s ON s.id = l.server_id
        LEFT JOIN server_communities c ON c.id = s.community_id
        WHERE ($1::text IS NULL OR l.steam_id64 = $1)
          AND ($2::text IS NULL OR l.server_id = $2)
          AND ($3::text IS NULL OR l.ip_address = $3)
          AND ($4::bool IS NULL OR l.allowed = $4)
          AND ($5::text IS NULL OR l.access_method = $5)
          AND ($6::text IS NULL OR l.failure_code = $6)
          AND (
              $7::text IS NULL
              OR l.player_name ILIKE $7
              OR l.steam_id64 ILIKE $7
              OR s.name ILIKE $7
          )
        ORDER BY l.occurred_at DESC
        LIMIT $8 OFFSET $9
        ",
    )
    .bind(&steam_id64)
    .bind(&server_id)
    .bind(&ip_address)
    .bind(query.allowed)
    .bind(&access_method)
    .bind(&failure_code)
    .bind(&search)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(AccessLogPage {
        items,
        total,
        page,
        page_size,
    }))
}

#[utoipa::path(
    get,
    path = "/api/v1/admin/player-detail/search",
    tag = "admin",
    responses(
        (status = 200, description = "Player candidates matching a SteamID, name or IP"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse)
    )
)]
pub async fn search_player_detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PlayerSearchQuery>,
) -> Result<Json<Vec<PlayerCandidate>>, AppError> {
    require_admin(&state, &headers).await?;

    let Some(raw) = optional_trim(query.q.as_deref()) else {
        return Ok(Json(Vec::new()));
    };
    if raw.chars().count() < 2 || raw.chars().count() > MAX_SEARCH_CHARS {
        return Ok(Json(Vec::new()));
    }

    let steam_id64 = parse_steam_identifier(&raw);
    let ip_address = raw.parse::<IpAddr>().ok().map(|ip| ip.to_string());
    let pattern = if steam_id64.is_none() && ip_address.is_none() {
        Some(format!("%{raw}%"))
    } else {
        None
    };

    let rows = sqlx::query_as::<_, PlayerCandidate>(
        r"
        WITH hits AS (
            SELECT u.steam_id64, u.persona_name AS name, u.avatar_url,
                   u.last_login_at AS seen_at
            FROM users u
            WHERE ($1::text IS NOT NULL AND (u.persona_name ILIKE $1 OR u.steam_id64 = $2))
               OR ($3::text IS NOT NULL AND u.last_login_ip = $3)
            UNION ALL
            SELECT p.steam_id64, p.display_name, p.avatar_url, p.last_seen_at
            FROM server_players p
            WHERE ($1::text IS NOT NULL AND (p.display_name ILIKE $1 OR p.steam_id64 = $2))
               OR ($3::text IS NOT NULL AND p.ip_address = $3)
            UNION ALL
            SELECT l.steam_id64, l.player_name, NULL, l.occurred_at
            FROM server_access_logs l
            WHERE ($1::text IS NOT NULL AND (l.player_name ILIKE $1 OR l.steam_id64 = $2))
               OR ($3::text IS NOT NULL AND l.ip_address = $3)
            UNION ALL
            SELECT p.steam_id64, p.player_name, NULL, p.last_seen_at
            FROM server_player_sessions p
            WHERE ($1::text IS NOT NULL AND (p.player_name ILIKE $1 OR p.steam_id64 = $2))
               OR ($3::text IS NOT NULL AND p.ip_address = $3)
            UNION ALL
            SELECT b.steam_id64, coalesce(b.player_name, b.steam_id64), NULL, b.created_at
            FROM server_bans b
            WHERE ($1::text IS NOT NULL AND (b.player_name ILIKE $1 OR b.steam_id64 = $2))
            UNION ALL
            SELECT w.steam_id64, coalesce(w.player_name, w.steam_id64), NULL, w.created_at
            FROM global_whitelist w
            WHERE ($1::text IS NOT NULL AND (w.player_name ILIKE $1 OR w.steam_id64 = $2))
        )
        SELECT h.steam_id64,
               coalesce(
                   u.persona_name,
                   (array_agg(h.name ORDER BY h.seen_at DESC))[1],
                   h.steam_id64
               ) AS name,
               coalesce(
                   u.avatar_url,
                   max(h.avatar_url) FILTER (WHERE h.avatar_url IS NOT NULL)
               ) AS avatar_url,
               max(h.seen_at) AS last_seen_at,
               EXISTS (
                   SELECT 1 FROM server_players p
                   WHERE p.steam_id64 = h.steam_id64
                     AND p.last_seen_at > now() - interval '5 minutes'
               ) AS online
        FROM hits h
        LEFT JOIN users u ON u.steam_id64 = h.steam_id64
        GROUP BY h.steam_id64, u.persona_name, u.avatar_url
        ORDER BY max(h.seen_at) DESC
        LIMIT 10
        ",
    )
    .bind(&pattern)
    .bind(&steam_id64)
    .bind(&ip_address)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

#[utoipa::path(
    get,
    path = "/api/v1/admin/player-detail",
    tag = "admin",
    responses(
        (status = 200, description = "Aggregated administrator player profile"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Player not found", body = crate::errors::ErrorResponse)
    )
)]
#[allow(clippy::too_many_lines)]
pub async fn get_player_detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PlayerDetailQuery>,
) -> Result<Json<PlayerDetail>, AppError> {
    require_admin(&state, &headers).await?;

    let Some(raw) = optional_trim(query.steam_input.as_deref()) else {
        return Err(AppError::Validation("steamInput is required".to_owned()));
    };
    let steam_id64 = parse_steam_identifier(&raw).ok_or_else(|| {
        AppError::Validation("steamInput must be a SteamID64, SteamID2 or SteamID3".to_owned())
    })?;

    let user = sqlx::query_as::<_, UserProfileRow>(
        r"
        SELECT persona_name, avatar_url, role, bio, location, is_disabled,
               created_at, last_login_at
        FROM users
        WHERE steam_id64 = $1
        ",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?;

    let latest_roster = sqlx::query_as::<_, LatestRosterRow>(
        r"
        SELECT display_name, avatar_url
        FROM server_players
        WHERE steam_id64 = $1
        ORDER BY last_seen_at DESC
        LIMIT 1
        ",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?;

    let latest_access = sqlx::query_as::<_, LatestAccessRow>(
        r"
        SELECT player_name
        FROM server_access_logs
        WHERE steam_id64 = $1
        ORDER BY occurred_at DESC
        LIMIT 1
        ",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?;

    let latest_session = sqlx::query_as::<_, LatestSessionRow>(
        r"
        SELECT player_name
        FROM server_player_sessions
        WHERE steam_id64 = $1
        ORDER BY last_seen_at DESC
        LIMIT 1
        ",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?;

    let latest_ban_name = sqlx::query_as::<_, LatestBanNameRow>(
        r"
        SELECT player_name
        FROM server_bans
        WHERE steam_id64 = $1 AND player_name IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
        ",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?;

    let whitelist_name = sqlx::query_scalar::<_, Option<String>>(
        "SELECT player_name FROM global_whitelist WHERE steam_id64 = $1",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?
    .flatten();

    if user.is_none()
        && latest_roster.is_none()
        && latest_access.is_none()
        && latest_session.is_none()
        && latest_ban_name.is_none()
        && whitelist_name.is_none()
    {
        return Err(AppError::NotFound);
    }

    let name = user
        .as_ref()
        .map(|row| row.persona_name.clone())
        .or_else(|| latest_roster.as_ref().map(|row| row.display_name.clone()))
        .or_else(|| latest_access.as_ref().map(|row| row.player_name.clone()))
        .or_else(|| latest_session.as_ref().map(|row| row.player_name.clone()))
        .or_else(|| latest_ban_name.as_ref().map(|row| row.player_name.clone()))
        .or_else(|| whitelist_name.clone())
        .unwrap_or_else(|| steam_id64.clone());
    let avatar_url = user
        .as_ref()
        .and_then(|row| row.avatar_url.clone())
        .or_else(|| {
            latest_roster
                .as_ref()
                .and_then(|row| row.avatar_url.clone())
        });

    let online_servers = sqlx::query_as::<_, PlayerOnlineServer>(
        r"
        SELECT p.server_id AS id, s.name, s.map, p.connected_at
        FROM server_players p
        JOIN servers s ON s.id = p.server_id
        WHERE p.steam_id64 = $1
          AND p.last_seen_at > now() - interval '5 minutes'
        ORDER BY p.last_seen_at DESC
        ",
    )
    .bind(&steam_id64)
    .fetch_all(&state.db)
    .await?;

    let access_logs = load_player_access_logs(&state.db, &steam_id64).await?;
    let sessions = load_player_sessions(&state.db, &steam_id64).await?;
    let game_bans = load_player_game_bans(&state.db, &steam_id64).await?;
    let whitelist_applications = load_player_whitelist_applications(&state.db, &steam_id64).await?;
    let whitelist_entries = load_player_whitelist_entries(&state.db, &steam_id64).await?;
    let (ip_groups, ip_ban_rows) = load_player_ips(&state.db, &steam_id64).await?;
    let internal_profile = load_internal_profile(&state.db, &steam_id64).await?;

    let (first_seen_at, last_seen_at) =
        sqlx::query_as::<_, (Option<DateTime<Utc>>, Option<DateTime<Utc>>)>(
            r"
        SELECT min(seen_at), max(seen_at)
        FROM (
            SELECT occurred_at AS seen_at
            FROM server_access_logs WHERE steam_id64 = $1
            UNION ALL
            SELECT joined_at FROM server_player_sessions WHERE steam_id64 = $1
            UNION ALL
            SELECT last_seen_at FROM server_player_sessions WHERE steam_id64 = $1
            UNION ALL
            SELECT created_at FROM users WHERE steam_id64 = $1
            UNION ALL
            SELECT created_at FROM server_bans WHERE steam_id64 = $1
            UNION ALL
            SELECT created_at FROM global_whitelist WHERE steam_id64 = $1
        ) sightings
        ",
        )
        .bind(&steam_id64)
        .fetch_one(&state.db)
        .await?;

    let (access_success, access_failure, active_ban_count, session_count, total_play_seconds) =
        sqlx::query_as::<_, (i64, i64, i64, i64, i64)>(
            r"
            SELECT
                (SELECT count(*) FROM server_access_logs
                 WHERE steam_id64 = $1 AND allowed)::bigint,
                (SELECT count(*) FROM server_access_logs
                 WHERE steam_id64 = $1 AND NOT allowed)::bigint,
                (SELECT count(*) FROM server_bans
                 WHERE steam_id64 = $1
                   AND lifted_at IS NULL
                   AND (expires_at IS NULL OR expires_at > now()))::bigint,
                (SELECT count(*) FROM server_player_sessions
                 WHERE steam_id64 = $1)::bigint,
                (SELECT coalesce(sum(
                     EXTRACT(EPOCH FROM (coalesce(left_at, now()) - joined_at))
                 ), 0)::bigint
                 FROM server_player_sessions WHERE steam_id64 = $1)
            ",
        )
        .bind(&steam_id64)
        .fetch_one(&state.db)
        .await?;

    let (topics, replies) = match user.as_ref() {
        Some(_) => {
            sqlx::query_as::<_, (i64, i64)>(
                r"
                SELECT
                    (SELECT count(*) FROM topics t
                     JOIN users u ON u.id = t.author_id
                     WHERE u.steam_id64 = $1 AND t.deleted_at IS NULL)::bigint,
                    (SELECT count(*) FROM replies r
                     JOIN users u ON u.id = r.author_id
                     WHERE u.steam_id64 = $1 AND r.deleted_at IS NULL)::bigint
                ",
            )
            .bind(&steam_id64)
            .fetch_one(&state.db)
            .await?
        }
        None => (0, 0),
    };

    let linked_account_count = i64::try_from(
        ip_groups
            .iter()
            .flat_map(|group| group.linked_accounts.iter())
            .map(|account| account.steam_id64.as_str())
            .collect::<HashSet<_>>()
            .len(),
    )
    .unwrap_or(i64::MAX);

    let detail_stats = PlayerDetailStats {
        access_success,
        access_failure,
        active_ban_count,
        known_ip_count: i64::try_from(ip_groups.len()).unwrap_or(i64::MAX),
        linked_account_count,
        total_play_seconds,
        session_count,
        topics,
        replies,
    };

    let timeline = build_timeline(
        &state.db,
        &steam_id64,
        &access_logs,
        &sessions,
        &game_bans,
        &ip_ban_rows,
        &whitelist_applications,
        &internal_profile.history,
    )
    .await?;

    Ok(Json(PlayerDetail {
        profile: PlayerDetailProfile {
            steam_id64,
            name,
            avatar_url,
            role: user
                .as_ref()
                .map_or_else(|| "member".to_owned(), |row| row.role.clone()),
            bio: user
                .as_ref()
                .map_or_else(String::new, |row| row.bio.clone()),
            location: user
                .as_ref()
                .map_or_else(String::new, |row| row.location.clone()),
            is_disabled: user.as_ref().is_some_and(|row| row.is_disabled),
            registered_at: user.as_ref().map(|row| row.created_at),
            last_login_at: user.as_ref().map(|row| row.last_login_at),
            first_seen_at: first_seen_at.or_else(|| user.as_ref().map(|row| row.created_at)),
            last_seen_at: last_seen_at.or_else(|| user.as_ref().map(|row| row.last_login_at)),
            online: !online_servers.is_empty(),
        },
        online_servers,
        stats: detail_stats,
        access_logs,
        sessions,
        game_bans,
        ip_bans: ip_ban_rows,
        whitelist_applications,
        whitelist_entries,
        ip_groups,
        timeline_total: i64::try_from(timeline.len()).unwrap_or(i64::MAX),
        timeline,
        internal_profile,
    }))
}

#[utoipa::path(
    put,
    path = "/api/v1/admin/player-detail/{steam_id64}/profile",
    tag = "admin",
    params(("steam_id64" = String, Path, description = "SteamID64")),
    request_body = UpdatePlayerProfileRequest,
    responses(
        (status = 204, description = "Internal note and tags updated"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 422, description = "Invalid note or tags", body = crate::errors::ErrorResponse)
    )
)]
pub async fn update_player_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(steam_id64): Path<String>,
    Json(request): Json<UpdatePlayerProfileRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let steam_id64 = steam_id64.trim();
    if !is_steam_id64(steam_id64) {
        return Err(AppError::Validation(
            "steamId64 must be a 17-digit number".to_owned(),
        ));
    }
    let note = normalize_note(&request.note)?;
    let tags = normalize_tags(request.tags)?;

    let mut transaction = state.db.begin().await?;
    sqlx::query(
        r"
        INSERT INTO player_admin_profiles (steam_id64, note, tags, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (steam_id64) DO UPDATE SET
            note = EXCLUDED.note,
            tags = EXCLUDED.tags,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
        ",
    )
    .bind(steam_id64)
    .bind(&note)
    .bind(&tags)
    .bind(admin.id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        r"
        INSERT INTO player_admin_profile_history (
            steam_id64, note, tags, changed_by
        )
        VALUES ($1, $2, $3, $4)
        ",
    )
    .bind(steam_id64)
    .bind(&note)
    .bind(&tags)
    .bind(admin.id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn load_player_access_logs(
    db: &PgPool,
    steam_id64: &str,
) -> Result<Vec<AccessLogItem>, AppError> {
    let logs = sqlx::query_as::<_, AccessLogItem>(
        r"
        SELECT l.id, l.server_id, s.name AS server_name, s.port AS server_port,
               c.name AS community_name, l.steam_id64, l.player_name,
               l.ip_address, l.allowed, l.access_method, l.failure_code,
               l.reject_reason, l.rating, l.steam_level, l.occurred_at
        FROM server_access_logs l
        JOIN servers s ON s.id = l.server_id
        LEFT JOIN server_communities c ON c.id = s.community_id
        WHERE l.steam_id64 = $1
        ORDER BY l.occurred_at DESC
        LIMIT 100
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;
    Ok(logs)
}

async fn load_player_sessions(
    db: &PgPool,
    steam_id64: &str,
) -> Result<Vec<PlayerSessionItem>, AppError> {
    let sessions = sqlx::query_as::<_, PlayerSessionItem>(
        r"
        SELECT p.id, p.server_id, s.name AS server_name, p.player_name,
               p.ip_address, p.joined_at, p.last_seen_at, p.left_at,
               p.leave_reason,
               GREATEST(
                   EXTRACT(EPOCH FROM (coalesce(p.left_at, now()) - p.joined_at)),
                   0
               )::bigint AS duration_seconds
        FROM server_player_sessions p
        JOIN servers s ON s.id = p.server_id
        WHERE p.steam_id64 = $1
        ORDER BY p.joined_at DESC
        LIMIT 100
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;
    Ok(sessions)
}

async fn load_player_game_bans(
    db: &PgPool,
    steam_id64: &str,
) -> Result<Vec<PlayerGameBanItem>, AppError> {
    let bans = sqlx::query_as::<_, PlayerGameBanItem>(
        r"
        SELECT b.id,
               CASE WHEN b.server_id IS NULL THEN 'global' ELSE 'server' END AS scope,
               coalesce(s.name, '全服') AS server_name,
               b.reason, b.created_at, b.expires_at, b.lifted_at,
               coalesce(creator.persona_name, '已删除管理员') AS created_by,
               lifter.persona_name AS lifted_by,
               (b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS is_active
        FROM server_bans b
        LEFT JOIN servers s ON s.id = b.server_id
        LEFT JOIN users creator ON creator.id = b.created_by
        LEFT JOIN users lifter ON lifter.id = b.lifted_by
        WHERE b.steam_id64 = $1
        ORDER BY b.created_at DESC
        LIMIT 100
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;
    Ok(bans)
}

async fn load_player_whitelist_applications(
    db: &PgPool,
    steam_id64: &str,
) -> Result<Vec<PlayerWhitelistApplicationItem>, AppError> {
    let applications = sqlx::query_as::<_, PlayerWhitelistApplicationItem>(
        r"
        SELECT a.id, a.status, a.message, a.created_at, a.reviewed_at,
               reviewer.persona_name AS reviewed_by, a.review_note,
               coalesce(s.name, '全服') AS server_name
        FROM whitelist_applications a
        LEFT JOIN servers s ON s.id = a.server_id
        LEFT JOIN users reviewer ON reviewer.id = a.reviewed_by
        WHERE a.steam_id64 = $1
        ORDER BY a.created_at DESC
        LIMIT 100
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;
    Ok(applications)
}

async fn load_player_whitelist_entries(
    db: &PgPool,
    steam_id64: &str,
) -> Result<Vec<PlayerWhitelistEntryItem>, AppError> {
    let entries = sqlx::query_as::<_, PlayerWhitelistEntryItem>(
        r"
        SELECT '全服' AS server_name, w.created_at, adder.persona_name AS added_by
        FROM global_whitelist w
        LEFT JOIN users adder ON adder.id = w.added_by
        WHERE w.steam_id64 = $1
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;
    Ok(entries)
}

#[allow(clippy::too_many_lines)]
async fn load_player_ips(
    db: &PgPool,
    steam_id64: &str,
) -> Result<(Vec<PlayerIpGroup>, Vec<PlayerIpBanItem>), AppError> {
    let known_ips = sqlx::query_as::<_, KnownIpRow>(
        r"
        WITH sightings AS (
            SELECT ip_address, occurred_at AS seen_at
            FROM server_access_logs
            WHERE steam_id64 = $1 AND ip_address IS NOT NULL
            UNION ALL
            SELECT ip_address, last_seen_at
            FROM server_players
            WHERE steam_id64 = $1 AND ip_address IS NOT NULL
            UNION ALL
            SELECT ip_address, last_seen_at
            FROM server_player_sessions
            WHERE steam_id64 = $1 AND ip_address IS NOT NULL
            UNION ALL
            SELECT last_login_ip, last_login_at
            FROM users
            WHERE steam_id64 = $1 AND last_login_ip IS NOT NULL
            UNION ALL
            SELECT s.ip_address, s.created_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE u.steam_id64 = $1 AND s.ip_address IS NOT NULL
        )
        SELECT ip_address, min(seen_at) AS first_seen_at,
               max(seen_at) AS last_seen_at, count(*)::bigint AS access_count
        FROM sightings
        GROUP BY ip_address
        ORDER BY max(seen_at) DESC
        LIMIT 50
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;

    let ip_addresses = known_ips
        .iter()
        .map(|row| row.ip_address.clone())
        .collect::<Vec<_>>();

    let linked_rows = if ip_addresses.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, LinkedAccountRow>(
            r"
            WITH sightings AS (
                SELECT steam_id64, ip_address, last_seen_at AS seen_at
                FROM server_players
                WHERE ip_address = ANY($2) AND steam_id64 <> $1
                UNION ALL
                SELECT steam_id64, ip_address, occurred_at
                FROM server_access_logs
                WHERE ip_address = ANY($2) AND steam_id64 <> $1
                UNION ALL
                SELECT steam_id64, ip_address, last_seen_at
                FROM server_player_sessions
                WHERE ip_address = ANY($2) AND steam_id64 <> $1
                UNION ALL
                SELECT u.steam_id64, s.ip_address, s.created_at
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.ip_address = ANY($2) AND u.steam_id64 <> $1
                UNION ALL
                SELECT steam_id64, last_login_ip, last_login_at
                FROM users
                WHERE last_login_ip = ANY($2) AND steam_id64 <> $1
            )
            SELECT h.ip_address, h.steam_id64,
                   coalesce(
                       u.persona_name,
                       (SELECT l.player_name FROM server_access_logs l
                        WHERE l.steam_id64 = h.steam_id64
                        ORDER BY l.occurred_at DESC LIMIT 1),
                       (SELECT p.display_name FROM server_players p
                        WHERE p.steam_id64 = h.steam_id64
                        ORDER BY p.last_seen_at DESC LIMIT 1),
                       h.steam_id64
                   ) AS name,
                   u.avatar_url,
                   max(h.seen_at) AS last_seen_at,
                   EXISTS (
                       SELECT 1 FROM server_bans b
                       WHERE b.steam_id64 = h.steam_id64
                         AND b.lifted_at IS NULL
                         AND (b.expires_at IS NULL OR b.expires_at > now())
                   ) AS has_active_ban,
                   EXISTS (
                       SELECT 1 FROM server_ip_bans b
                       WHERE b.ip_address = h.ip_address
                         AND b.lifted_at IS NULL
                         AND (b.expires_at IS NULL OR b.expires_at > now())
                   ) AS has_active_ip_ban,
                   EXISTS (
                       SELECT 1 FROM global_whitelist w
                       WHERE w.steam_id64 = h.steam_id64
                   ) AS has_whitelist,
                   EXISTS (
                       SELECT 1 FROM server_players p
                       WHERE p.steam_id64 = h.steam_id64
                         AND p.last_seen_at > now() - interval '5 minutes'
                   ) AS online
            FROM sightings h
            LEFT JOIN users u ON u.steam_id64 = h.steam_id64
            GROUP BY h.ip_address, h.steam_id64, u.persona_name, u.avatar_url
            ORDER BY h.ip_address, max(h.seen_at) DESC
            ",
        )
        .bind(steam_id64)
        .bind(&ip_addresses)
        .fetch_all(db)
        .await?
    };

    let mut linked_by_ip = HashMap::<String, Vec<LinkedAccount>>::new();
    for row in linked_rows {
        linked_by_ip
            .entry(row.ip_address)
            .or_default()
            .push(LinkedAccount {
                steam_id64: row.steam_id64,
                name: row.name,
                avatar_url: row.avatar_url,
                last_seen_at: row.last_seen_at,
                online: row.online,
                has_active_ban: row.has_active_ban,
                has_active_ip_ban: row.has_active_ip_ban,
                has_whitelist: row.has_whitelist,
            });
    }

    let groups = known_ips
        .into_iter()
        .map(|row| PlayerIpGroup {
            ip_address: row.ip_address.clone(),
            first_seen_at: row.first_seen_at,
            last_seen_at: row.last_seen_at,
            access_count: row.access_count,
            linked_accounts: linked_by_ip.remove(&row.ip_address).unwrap_or_default(),
        })
        .collect::<Vec<_>>();

    let ip_bans = if ip_addresses.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, PlayerIpBanItem>(
            r"
            SELECT b.id, b.ip_address, b.reason, b.created_at, b.expires_at,
                   b.lifted_at,
                   coalesce(creator.persona_name, '已删除管理员') AS created_by,
                   lifter.persona_name AS lifted_by,
                   (b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS is_active
            FROM server_ip_bans b
            LEFT JOIN users creator ON creator.id = b.created_by
            LEFT JOIN users lifter ON lifter.id = b.lifted_by
            WHERE b.ip_address = ANY($1)
            ORDER BY b.created_at DESC
            LIMIT 100
            ",
        )
        .bind(&ip_addresses)
        .fetch_all(db)
        .await?
    };

    Ok((groups, ip_bans))
}

async fn load_internal_profile(
    db: &PgPool,
    steam_id64: &str,
) -> Result<PlayerInternalProfile, AppError> {
    let profile = sqlx::query_as::<_, InternalProfileRow>(
        r"
        SELECT p.note, p.tags, p.updated_at, updater.persona_name AS updated_by
        FROM player_admin_profiles p
        LEFT JOIN users updater ON updater.id = p.updated_by
        WHERE p.steam_id64 = $1
        ",
    )
    .bind(steam_id64)
    .fetch_optional(db)
    .await?;

    let history = sqlx::query_as::<_, NoteHistoryItem>(
        r"
        SELECT h.id, h.note, h.tags, h.changed_at,
               changer.persona_name AS changed_by
        FROM player_admin_profile_history h
        LEFT JOIN users changer ON changer.id = h.changed_by
        WHERE h.steam_id64 = $1
        ORDER BY h.changed_at DESC
        LIMIT 20
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;

    Ok(match profile {
        Some(row) => PlayerInternalProfile {
            note: row.note,
            tags: row.tags,
            updated_at: Some(row.updated_at),
            updated_by: row.updated_by,
            history,
        },
        None => PlayerInternalProfile {
            note: String::new(),
            tags: Vec::new(),
            updated_at: None,
            updated_by: None,
            history,
        },
    })
}

#[allow(clippy::too_many_arguments, clippy::too_many_lines)]
async fn build_timeline(
    db: &PgPool,
    steam_id64: &str,
    access_logs: &[AccessLogItem],
    sessions: &[PlayerSessionItem],
    game_bans: &[PlayerGameBanItem],
    ip_bans: &[PlayerIpBanItem],
    whitelist_applications: &[PlayerWhitelistApplicationItem],
    note_history: &[NoteHistoryItem],
) -> Result<Vec<TimelineEvent>, AppError> {
    let mut events = Vec::new();

    for log in access_logs {
        let description = if log.allowed {
            format!("方式：{}", access_method_label(&log.access_method))
        } else {
            let reason = log.failure_code.as_deref().map_or_else(
                || log.reject_reason.clone().unwrap_or_default(),
                failure_label,
            );
            let detail = log.reject_reason.as_deref().unwrap_or("");
            if detail.is_empty() {
                format!(
                    "方式：{} · 原因：{reason}",
                    access_method_label(&log.access_method)
                )
            } else {
                format!(
                    "方式：{} · 原因：{reason} · {detail}",
                    access_method_label(&log.access_method)
                )
            }
        };
        events.push(TimelineEvent {
            id: format!("access:{}", log.id),
            kind: "access".to_owned(),
            occurred_at: log.occurred_at,
            title: if log.allowed {
                "进服成功".to_owned()
            } else {
                "进服失败".to_owned()
            },
            description,
            actor: Some(log.player_name.clone()),
            server_name: Some(log.server_name.clone()),
        });
    }

    for session in sessions {
        events.push(TimelineEvent {
            id: format!("session-join:{}", session.id),
            kind: "session".to_owned(),
            occurred_at: session.joined_at,
            title: if session.left_at.is_some() {
                "在线会话开始".to_owned()
            } else {
                "在线会话开始（进行中）".to_owned()
            },
            description: session
                .ip_address
                .as_ref()
                .map_or_else(String::new, |ip| format!("IP：{ip}")),
            actor: Some(session.player_name.clone()),
            server_name: Some(session.server_name.clone()),
        });
        if let Some(left_at) = session.left_at {
            let duration = format_duration_seconds(session.duration_seconds);
            let description = session.leave_reason.as_deref().map_or_else(
                || format!("在线时长：{duration}"),
                |reason| {
                    format!(
                        "在线时长：{duration} · 离开原因：{}",
                        leave_reason_label(reason)
                    )
                },
            );
            events.push(TimelineEvent {
                id: format!("session-leave:{}", session.id),
                kind: "session".to_owned(),
                occurred_at: left_at,
                title: "在线会话结束".to_owned(),
                description,
                actor: Some(session.player_name.clone()),
                server_name: Some(session.server_name.clone()),
            });
        }
    }

    for ban in game_bans {
        events.push(TimelineEvent {
            id: format!("ban:{}", ban.id),
            kind: "ban".to_owned(),
            occurred_at: ban.created_at,
            title: if ban.scope == "global" {
                "全服游戏封禁".to_owned()
            } else {
                "单服游戏封禁".to_owned()
            },
            description: format!("范围：{} · 原因：{}", ban.server_name, ban.reason),
            actor: Some(ban.created_by.clone()),
            server_name: Some(ban.server_name.clone()),
        });
        if let Some(lifted_at) = ban.lifted_at {
            events.push(TimelineEvent {
                id: format!("ban-lift:{}", ban.id),
                kind: "ban".to_owned(),
                occurred_at: lifted_at,
                title: "游戏封禁已解除".to_owned(),
                description: ban
                    .lifted_by
                    .as_ref()
                    .map_or_else(String::new, |name| format!("操作人：{name}")),
                actor: ban.lifted_by.clone(),
                server_name: Some(ban.server_name.clone()),
            });
        }
    }

    for ban in ip_bans {
        events.push(TimelineEvent {
            id: format!("ip-ban:{}", ban.id),
            kind: "ban".to_owned(),
            occurred_at: ban.created_at,
            title: "IP 封禁".to_owned(),
            description: format!("IP：{} · 原因：{}", ban.ip_address, ban.reason),
            actor: Some(ban.created_by.clone()),
            server_name: None,
        });
        if let Some(lifted_at) = ban.lifted_at {
            events.push(TimelineEvent {
                id: format!("ip-ban-lift:{}", ban.id),
                kind: "ban".to_owned(),
                occurred_at: lifted_at,
                title: "IP 封禁已解除".to_owned(),
                description: ban
                    .lifted_by
                    .as_ref()
                    .map_or_else(String::new, |name| format!("操作人：{name}")),
                actor: ban.lifted_by.clone(),
                server_name: None,
            });
        }
    }

    for application in whitelist_applications {
        events.push(TimelineEvent {
            id: format!("whitelist-apply:{}", application.id),
            kind: "whitelist".to_owned(),
            occurred_at: application.created_at,
            title: "提交白名单申请".to_owned(),
            description: application.message.clone(),
            actor: None,
            server_name: Some(application.server_name.clone()),
        });
        if let Some(reviewed_at) = application.reviewed_at {
            events.push(TimelineEvent {
                id: format!("whitelist-review:{}", application.id),
                kind: "whitelist".to_owned(),
                occurred_at: reviewed_at,
                title: match application.status.as_str() {
                    "approved" => "白名单申请通过",
                    "rejected" => "白名单申请被拒",
                    _ => "白名单申请已审核",
                }
                .to_owned(),
                description: application.review_note.clone().unwrap_or_default(),
                actor: application.reviewed_by.clone(),
                server_name: Some(application.server_name.clone()),
            });
        }
    }

    for item in note_history {
        events.push(TimelineEvent {
            id: format!("note:{}", item.id),
            kind: "internal".to_owned(),
            occurred_at: item.changed_at,
            title: "更新内部备注".to_owned(),
            description: if item.note.is_empty() {
                "清空备注".to_owned()
            } else {
                item.note.chars().take(200).collect()
            },
            actor: item.changed_by.clone(),
            server_name: None,
        });
    }

    let forum_events = sqlx::query_as::<_, ForumEventRow>(
        r"
        SELECT 'topic' AS kind, t.id::text AS id, t.title, ''::text AS description,
               t.created_at AS occurred_at, NULL::text AS server_name
        FROM topics t
        JOIN users u ON u.id = t.author_id
        WHERE u.steam_id64 = $1 AND t.deleted_at IS NULL
        UNION ALL
        SELECT 'reply', r.id::text, t.title, left(r.content, 200), r.created_at, NULL
        FROM replies r
        JOIN topics t ON t.id = r.topic_id
        JOIN users u ON u.id = r.author_id
        WHERE u.steam_id64 = $1 AND r.deleted_at IS NULL
        ORDER BY occurred_at DESC
        LIMIT 50
        ",
    )
    .bind(steam_id64)
    .fetch_all(db)
    .await?;
    for event in forum_events {
        let (title, description) = if event.kind == "topic" {
            (format!("发布主题：{}", event.title), String::new())
        } else {
            (
                format!("回复主题：{}", event.title),
                event.description.clone(),
            )
        };
        events.push(TimelineEvent {
            id: format!("forum:{}:{}", event.kind, event.id),
            kind: "forum".to_owned(),
            occurred_at: event.occurred_at,
            title,
            description,
            actor: None,
            server_name: event.server_name,
        });
    }

    events.sort_by_key(|event| std::cmp::Reverse(event.occurred_at));
    events.truncate(200);
    Ok(events)
}

fn optional_trim(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn is_steam_id64(value: &str) -> bool {
    value.len() == 17 && value.chars().all(|ch| ch.is_ascii_digit())
}

fn canonical_ip(value: &str) -> Result<String, AppError> {
    value
        .trim()
        .parse::<IpAddr>()
        .map(|ip| ip.to_string())
        .map_err(|_| AppError::Validation("ipAddress must be a valid IP address".to_owned()))
}

fn normalize_note(value: &str) -> Result<String, AppError> {
    let value = value.replace("\r\n", "\n").replace('\r', "\n");
    let value = value
        .chars()
        .filter(|ch| *ch == '\n' || *ch == '\t' || !ch.is_control())
        .collect::<String>();
    let value = value.trim().to_owned();
    if value.chars().count() > MAX_NOTE_CHARS {
        return Err(AppError::Validation(format!(
            "note must be at most {MAX_NOTE_CHARS} characters"
        )));
    }
    Ok(value)
}

fn normalize_tags(tags: Vec<String>) -> Result<Vec<String>, AppError> {
    let mut normalized = Vec::new();
    for tag in tags {
        let tag = tag
            .chars()
            .map(|ch| if ch.is_control() { ' ' } else { ch })
            .collect::<String>();
        let tag = tag.trim().trim_start_matches('#').trim();
        if tag.is_empty() {
            continue;
        }
        if tag.chars().count() > MAX_TAG_CHARS {
            return Err(AppError::Validation(format!(
                "each tag must be at most {MAX_TAG_CHARS} characters"
            )));
        }
        if normalized
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(tag))
        {
            continue;
        }
        if normalized.len() >= MAX_TAGS {
            return Err(AppError::Validation(format!(
                "at most {MAX_TAGS} tags are allowed"
            )));
        }
        normalized.push(tag.to_owned());
    }
    Ok(normalized)
}

fn access_method_label(value: &str) -> &str {
    match value {
        "unrestricted" => "无限制",
        "whitelist" => "白名单",
        "snapshot_fallback" => "快照回退",
        "banned" => "封禁拦截",
        "whitelist_rejected" => "白名单拒绝",
        "access_unavailable" => "访问控制不可用",
        other => other,
    }
}

fn failure_label(value: &str) -> String {
    match value {
        "banned" => "存在游戏封禁",
        "ip_banned" => "IP 被封禁",
        "not_whitelisted" => "未通过白名单",
        "access_unavailable" => "访问控制服务不可用",
        "no_steamid" => "无法获取 SteamID",
        other => other,
    }
    .to_owned()
}

fn leave_reason_label(value: &str) -> String {
    match value {
        "disconnect" => "玩家断开连接".to_owned(),
        "server_stale" => "服务器上报中断".to_owned(),
        other => other.to_owned(),
    }
}

fn format_duration_seconds(seconds: i64) -> String {
    let seconds = seconds.max(0);
    if seconds < 60 {
        return format!("{seconds} 秒");
    }
    let minutes = seconds / 60;
    if minutes < 60 {
        return format!("{minutes} 分钟");
    }
    let hours = minutes / 60;
    let rest_minutes = minutes % 60;
    if hours < 24 {
        return if rest_minutes == 0 {
            format!("{hours} 小时")
        } else {
            format!("{hours} 小时 {rest_minutes} 分钟")
        };
    }
    let days = hours / 24;
    let rest_hours = hours % 24;
    if rest_hours == 0 {
        format!("{days} 天")
    } else {
        format!("{days} 天 {rest_hours} 小时")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn steam_ids_are_validated() {
        assert!(is_steam_id64("76561198000000000"));
        assert!(!is_steam_id64("7656119800000000"));
        assert!(!is_steam_id64("7656119800000000a"));
    }

    #[test]
    fn session_durations_are_human_readable() {
        assert_eq!(format_duration_seconds(45), "45 秒");
        assert_eq!(format_duration_seconds(90), "1 分钟");
        assert_eq!(
            format_duration_seconds(3 * 3600 + 12 * 60),
            "3 小时 12 分钟"
        );
        assert_eq!(format_duration_seconds(2 * 86400 + 5 * 3600), "2 天 5 小时");
        assert_eq!(format_duration_seconds(-5), "0 秒");
    }

    #[test]
    fn tags_are_trimmed_deduplicated_and_capped() {
        let tags = normalize_tags(vec![
            " 重点  ".to_owned(),
            "#重点".to_owned(),
            "代练".to_owned(),
            String::new(),
        ])
        .expect("valid tags");
        assert_eq!(tags, vec!["重点", "代练"]);

        let too_many = (0..=MAX_TAGS)
            .map(|index| format!("tag-{index}"))
            .collect::<Vec<_>>();
        assert!(normalize_tags(too_many).is_err());
    }

    #[test]
    fn note_rejects_oversized_content() {
        assert!(normalize_note(&"a".repeat(MAX_NOTE_CHARS + 1)).is_err());
        assert_eq!(
            normalize_note(" 第一行\r\n第二行 ").expect("valid note"),
            "第一行\n第二行"
        );
    }

    #[test]
    fn ip_literals_are_canonicalized() {
        assert_eq!(
            canonical_ip(" 2001:0db8::1 ").expect("valid ip"),
            "2001:db8::1"
        );
        assert!(canonical_ip("not-an-ip").is_err());
    }
}
