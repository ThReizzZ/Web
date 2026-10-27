use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::get,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    errors::AppError,
    modules::forum::{TopicQuery, TopicSummary, fetch_topics},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct PlayerQuery {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineServer {
    pub id: String,
    pub name: String,
    pub map: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityPlayer {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub joined_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
    pub topics: i64,
    pub replies: i64,
    pub online_server: Option<OnlineServer>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerStats {
    pub topics: i64,
    pub replies: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestServer {
    pub id: String,
    pub name: String,
    pub map: String,
    pub last_seen_at: DateTime<Utc>,
    pub online: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityPlayerDetail {
    pub id: Uuid,
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub bio: String,
    pub location: String,
    pub joined_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
    pub stats: PlayerStats,
    pub latest_server: Option<LatestServer>,
    pub recent_topics: Vec<TopicSummary>,
}

#[derive(Debug, FromRow)]
struct CommunityPlayerRow {
    id: Uuid,
    name: String,
    avatar_url: Option<String>,
    role: String,
    joined_at: DateTime<Utc>,
    last_login_at: DateTime<Utc>,
    topics: i64,
    replies: i64,
    online_server_id: Option<String>,
    online_server_name: Option<String>,
    online_server_map: Option<String>,
}

#[derive(Debug, FromRow)]
struct PlayerDetailRow {
    id: Uuid,
    steam_id64: String,
    name: String,
    avatar_url: Option<String>,
    role: String,
    bio: String,
    location: String,
    joined_at: DateTime<Utc>,
    last_login_at: DateTime<Utc>,
    topics: i64,
    replies: i64,
}

#[derive(Debug, FromRow)]
struct LatestServerRow {
    id: String,
    name: String,
    map: String,
    last_seen_at: DateTime<Utc>,
    online: bool,
}

const STEAM_ID64_BASE: u64 = 76_561_197_960_265_728;

/// Accepts `SteamID64`, `SteamID2` (`STEAM_0:0:...`) and `SteamID3` (`[U:1:...]`).
/// Returns the canonical 17-digit `SteamID64` used by the database.
fn parse_steam_identifier(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 64 {
        return None;
    }
    if value.len() == 17 && value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Some(value.to_owned());
    }

    let upper = value.to_ascii_uppercase();
    if let Some(rest) = upper.strip_prefix("STEAM_") {
        let parts = rest.split(':').collect::<Vec<_>>();
        if parts.len() == 3 && matches!(parts[0], "0" | "1") {
            let auth_server = parts[1].parse::<u64>().ok()?;
            let account = parts[2].parse::<u64>().ok()?;
            if auth_server > 1 || account > u64::from(u32::MAX) {
                return None;
            }
            let account_id = account.checked_mul(2)?.checked_add(auth_server)?;
            if account_id > u64::from(u32::MAX) {
                return None;
            }
            return Some((STEAM_ID64_BASE + account_id).to_string());
        }
    }

    let steam3 = upper.trim_start_matches('[').trim_end_matches(']');
    if let Some(rest) = steam3.strip_prefix("U:") {
        let parts = rest.split(':').collect::<Vec<_>>();
        if parts.len() == 2 {
            let universe = parts[0].parse::<u64>().ok()?;
            let account_id = parts[1].parse::<u64>().ok()?;
            if universe > 1 || account_id > u64::from(u32::MAX) {
                return None;
            }
            return Some((STEAM_ID64_BASE + account_id).to_string());
        }
    }

    None
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/players", get(list_players))
        .route("/players/{id}", get(get_player))
}

#[utoipa::path(
    get,
    path = "/api/v1/players",
    tag = "community",
    responses((status = 200, description = "Public community player directory"))
)]
async fn list_players(
    State(state): State<AppState>,
    Query(query): Query<PlayerQuery>,
) -> Result<Json<Vec<CommunityPlayer>>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let search = query
        .q
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if search
        .as_ref()
        .is_some_and(|value| value.chars().count() > 80)
    {
        return Err(AppError::validation(
            "q must be at most 80 characters".to_owned(),
        ));
    }
    let pattern = search.as_ref().map(|value| format!("%{value}%"));
    let steam_search = search.as_deref().and_then(parse_steam_identifier);

    let rows = sqlx::query_as::<_, CommunityPlayerRow>(
        r"
        SELECT u.id, u.persona_name AS name, u.avatar_url, u.role,
               u.created_at AS joined_at, u.last_login_at,
               (SELECT count(*) FROM topics t
                WHERE t.author_id = u.id AND t.deleted_at IS NULL)::bigint AS topics,
               (SELECT count(*) FROM replies r
                WHERE r.author_id = u.id AND r.deleted_at IS NULL)::bigint AS replies,
               sp.server_id AS online_server_id,
               s.name AS online_server_name,
               s.map AS online_server_map
        FROM users u
        LEFT JOIN LATERAL (
            SELECT p.server_id
            FROM server_players p
            WHERE p.user_id = u.id
              AND p.last_seen_at > now() - interval '5 minutes'
            ORDER BY p.last_seen_at DESC
            LIMIT 1
        ) sp ON true
        LEFT JOIN servers s ON s.id = sp.server_id
        WHERE u.is_system = false
          AND u.is_disabled = false
          AND ($1::text IS NULL OR u.persona_name ILIKE $1 OR u.steam_id64 = $2)
        ORDER BY CASE u.role
                     WHEN 'admin' THEN 0
                     WHEN 'moderator' THEN 1
                     ELSE 2
                 END,
                 (sp.server_id IS NOT NULL) DESC,
                 u.last_login_at DESC
        LIMIT $3
        ",
    )
    .bind(pattern)
    .bind(steam_search)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|row| CommunityPlayer {
                id: row.id,
                name: row.name,
                avatar_url: row.avatar_url,
                role: row.role,
                joined_at: row.joined_at,
                last_login_at: row.last_login_at,
                topics: row.topics,
                replies: row.replies,
                online_server: row.online_server_id.map(|id| OnlineServer {
                    id,
                    name: row.online_server_name.unwrap_or_default(),
                    map: row.online_server_map.unwrap_or_default(),
                }),
            })
            .collect(),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/players/{id}",
    tag = "community",
    params(("id" = String, Path, description = "Community player UUID, SteamID64, SteamID2 or SteamID3")),
    responses(
        (status = 200, description = "Public community player profile"),
        (status = 404, description = "Player not found")
    )
)]
async fn get_player(
    State(state): State<AppState>,
    Path(identifier): Path<String>,
) -> Result<Json<CommunityPlayerDetail>, AppError> {
    let user_id = Uuid::parse_str(identifier.trim()).ok();
    let steam_id64 = parse_steam_identifier(&identifier);
    if user_id.is_none() && steam_id64.is_none() {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as::<_, PlayerDetailRow>(
        r"
        SELECT u.id, u.steam_id64, u.persona_name AS name, u.avatar_url, u.role,
               u.bio, u.location, u.created_at AS joined_at, u.last_login_at,
               (SELECT count(*) FROM topics t
                WHERE t.author_id = u.id AND t.deleted_at IS NULL)::bigint AS topics,
               (SELECT count(*) FROM replies r
                WHERE r.author_id = u.id AND r.deleted_at IS NULL)::bigint AS replies
        FROM users u
        WHERE u.is_system = false
          AND u.is_disabled = false
          AND (($1::uuid IS NOT NULL AND u.id = $1)
               OR ($2::text IS NOT NULL AND u.steam_id64 = $2))
        ",
    )
    .bind(user_id)
    .bind(steam_id64)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let resolved_id = row.id;
    let latest_server = sqlx::query_as::<_, LatestServerRow>(
        r"
        SELECT s.id, s.name, s.map, p.last_seen_at,
               (p.last_seen_at > now() - interval '5 minutes') AS online
        FROM server_players p
        JOIN servers s ON s.id = p.server_id
        WHERE p.user_id = $1
        ORDER BY p.last_seen_at DESC
        LIMIT 1
        ",
    )
    .bind(resolved_id)
    .fetch_optional(&state.db)
    .await?
    .map(|server| LatestServer {
        id: server.id,
        name: server.name,
        map: server.map,
        last_seen_at: server.last_seen_at,
        online: server.online,
    });

    let recent_topics = fetch_topics(
        &state,
        TopicQuery {
            limit: Some(5),
            category: None,
            q: None,
            author: Some(resolved_id),
        },
    )
    .await?;

    Ok(Json(CommunityPlayerDetail {
        id: row.id,
        steam_id64: row.steam_id64,
        name: row.name,
        avatar_url: row.avatar_url,
        role: row.role,
        bio: row.bio,
        location: row.location,
        joined_at: row.joined_at,
        last_login_at: row.last_login_at,
        stats: PlayerStats {
            topics: row.topics,
            replies: row.replies,
        },
        latest_server,
        recent_topics,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_steam_id_formats() {
        assert_eq!(
            parse_steam_identifier("76561199790199218").as_deref(),
            Some("76561199790199218")
        );
        assert_eq!(
            parse_steam_identifier("STEAM_0:0:914966745").as_deref(),
            Some("76561199790199218")
        );
        assert_eq!(
            parse_steam_identifier("STEAM_1:1:914966745").as_deref(),
            Some("76561199790199219")
        );
        assert_eq!(
            parse_steam_identifier("[U:1:1829933490]").as_deref(),
            Some("76561199790199218")
        );
        assert_eq!(
            parse_steam_identifier("U:1:1829933490").as_deref(),
            Some("76561199790199218")
        );
        assert_eq!(parse_steam_identifier("ElliezzZ"), None);
        assert_eq!(parse_steam_identifier("STEAM_2:0:1"), None);
    }
}
