//! Authenticated reports from the `ThRei_Players` `SourceMod` plugin.
//!
//! The plugin owns the live server snapshot: map, human-player limit and the
//! `SteamID64` roster. The API authenticates each request with a per-server
//! token and replaces the stored roster transactionally. A stale sweep marks
//! plugin-managed servers offline and clears their roster after the plugin has
//! stopped reporting.

use std::{collections::HashSet, time::Duration};

use axum::{Json, Router, extract::State, http::HeaderMap, routing::post};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;

use crate::{errors::AppError, state::AppState};

const TOKEN_HEADER: &str = "x-threi-plugin-token";
const MAX_TOKEN_CHARS: usize = 128;
const MAX_PLAYERS: usize = 1024;
const MAX_NAME_CHARS: usize = 80;
const MAX_SERVER_NAME_CHARS: usize = 120;
const MAX_MAP_CHARS: usize = 128;
const MAX_CONNECTED_SECONDS: i64 = 2_592_000;
pub(crate) const STALE_AFTER_SECS: i32 = 90;
const SWEEP_INTERVAL: Duration = Duration::from_secs(30);

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginReportRequest {
    /// Optional server id. When omitted, the server is resolved from the
    /// unique plugin token, which lets one shared config map a port to a
    /// token without copying server ids. When present it must match the token.
    #[serde(default)]
    pub server_id: Option<String>,
    /// Server hostname as configured on the game server. Optional so older
    /// plugin versions keep working; when present it is shown in the catalog.
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub map: Option<String>,
    #[serde(default)]
    pub max_players: Option<i32>,
    #[serde(default)]
    pub players: Vec<PluginPlayer>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginPlayer {
    pub steam_id64: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub connected_seconds: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PluginReportResponse {
    pub server_id: String,
    pub player_count: i32,
    pub skipped: i32,
    pub reported_at: DateTime<Utc>,
}

#[derive(Debug)]
struct NormalizedPlayer {
    steam_id64: String,
    name: String,
    connected_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct ReportServerRow {
    id: String,
    last_reported_at: DateTime<Utc>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/plugin/report", post(report))
}

#[utoipa::path(
    post,
    path = "/api/v1/plugin/report",
    tag = "plugin",
    params(
        ("x-threi-plugin-token" = String, Header, description = "Per-server plugin token generated in the admin panel")
    ),
    request_body = PluginReportRequest,
    responses(
        (status = 200, description = "Report accepted and stored", body = PluginReportResponse),
        (status = 401, description = "Missing or invalid plugin token", body = crate::errors::ErrorResponse),
        (status = 422, description = "Invalid report fields", body = crate::errors::ErrorResponse)
    )
)]
pub async fn report(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<PluginReportRequest>,
) -> Result<Json<PluginReportResponse>, AppError> {
    let token = plugin_token(&headers)?;
    let server_id = normalize_server_id(request.server_id)?;
    let name = normalize_server_name(request.name);
    let map = normalize_map(request.map)?;
    validate_max_players(request.max_players)?;
    let (players, skipped) = normalize_players(&request.players, Utc::now());

    persist_report(
        &state.db,
        ReportPayload {
            server_id: server_id.as_deref(),
            token,
            name: name.as_deref(),
            map: map.as_deref(),
            max_players: request.max_players,
            players: &players,
            skipped,
        },
    )
    .await
    .map(Json)
}

/// Starts the stale-server sweep. The task lives for the process lifetime and
/// is cancelled by the Tokio runtime during shutdown.
///
/// When the RCON fallback is enabled, servers with a stored RCON password are
/// left to the hibernation poller: it can distinguish an empty hibernating
/// server from a dead one, while the plugin itself cannot report during
/// hibernation. Servers without RCON keep the original 90-second behavior.
pub fn spawn_stale_sweeper(db: PgPool, skip_rcon_servers: bool) {
    tracing::info!(
        sweep_interval_secs = SWEEP_INTERVAL.as_secs(),
        stale_after_secs = STALE_AFTER_SECS,
        skip_rcon_servers,
        "server plugin stale sweeper started"
    );

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(SWEEP_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            interval.tick().await;
            match sweep_stale(&db, skip_rcon_servers).await {
                Ok((0, 0)) => {}
                Ok((servers, players)) => {
                    tracing::info!(servers, players, "marked stale plugin servers offline");
                }
                Err(error) => {
                    tracing::warn!(%error, "failed to sweep stale plugin servers");
                }
            }
        }
    });
}

pub(crate) fn plugin_token(headers: &HeaderMap) -> Result<&str, AppError> {
    let token = headers
        .get(TOKEN_HEADER)
        .ok_or(AppError::Unauthorized)?
        .to_str()
        .map_err(|_| AppError::Unauthorized)?
        .trim();
    if token.is_empty() || token.chars().count() > MAX_TOKEN_CHARS {
        return Err(AppError::Unauthorized);
    }
    Ok(token)
}

/// Empty or missing ids are allowed: the token itself identifies the server.
/// A present id still has to be bounded and is checked against the token.
fn normalize_server_id(value: Option<String>) -> Result<Option<String>, AppError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = value.trim();
    if value.is_empty() {
        return Ok(None);
    }
    if value.chars().count() > 80 {
        return Err(AppError::Validation(
            "serverId must be at most 80 characters".to_owned(),
        ));
    }
    Ok(Some(value.to_owned()))
}

/// Trims the reported hostname, drops control characters and caps the length.
/// `None` means "keep the current name", so older plugin versions and empty
/// hostnames do not overwrite it.
fn normalize_server_name(value: Option<String>) -> Option<String> {
    let value = value?;
    let cleaned = sanitize_controls(&value);
    let value = cleaned.trim();
    if value.is_empty() {
        return None;
    }
    Some(truncate(value, MAX_SERVER_NAME_CHARS))
}

fn normalize_map(value: Option<String>) -> Result<Option<String>, AppError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let cleaned = sanitize_controls(value.trim());
    let value = cleaned.trim();
    if value.is_empty() {
        return Ok(None);
    }
    if value.chars().count() > MAX_MAP_CHARS {
        return Err(AppError::Validation(
            "map must be at most 128 characters".to_owned(),
        ));
    }
    Ok(Some(value.to_owned()))
}

fn validate_max_players(value: Option<i32>) -> Result<(), AppError> {
    if value.is_some_and(|max| !(1..=1024).contains(&max)) {
        return Err(AppError::Validation(
            "maxPlayers must be between 1 and 1024".to_owned(),
        ));
    }
    Ok(())
}

fn normalize_players(players: &[PluginPlayer], now: DateTime<Utc>) -> (Vec<NormalizedPlayer>, i32) {
    let mut seen = HashSet::with_capacity(players.len().min(MAX_PLAYERS));
    let mut normalized = Vec::with_capacity(players.len().min(MAX_PLAYERS));
    let mut skipped = 0_i32;

    for player in players {
        let steam_id64 = player.steam_id64.trim();
        if !is_valid_steam_id(steam_id64) || !seen.insert(steam_id64) {
            skipped += 1;
            continue;
        }
        if normalized.len() >= MAX_PLAYERS {
            skipped += 1;
            continue;
        }
        let connected_seconds = player
            .connected_seconds
            .unwrap_or_default()
            .clamp(0, MAX_CONNECTED_SECONDS);
        normalized.push(NormalizedPlayer {
            steam_id64: steam_id64.to_owned(),
            name: clean_name(&player.name, steam_id64),
            connected_at: now - ChronoDuration::seconds(connected_seconds),
        });
    }

    (normalized, skipped)
}

fn is_valid_steam_id(value: &str) -> bool {
    value.len() == 17 && value.chars().all(|ch| ch.is_ascii_digit())
}

fn clean_name(value: &str, fallback: &str) -> String {
    let cleaned = sanitize_controls(value.trim());
    let value = cleaned.trim();
    if value.is_empty() {
        truncate(fallback, MAX_NAME_CHARS)
    } else {
        truncate(value, MAX_NAME_CHARS)
    }
}

fn sanitize_controls(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect()
}

fn truncate(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_owned();
    }
    let mut truncated = value
        .chars()
        .take(max_chars.saturating_sub(1))
        .collect::<String>();
    truncated.push('…');
    truncated
}

struct ReportPayload<'a> {
    server_id: Option<&'a str>,
    token: &'a str,
    name: Option<&'a str>,
    map: Option<&'a str>,
    max_players: Option<i32>,
    players: &'a [NormalizedPlayer],
    skipped: i32,
}

async fn persist_report(
    db: &PgPool,
    report: ReportPayload<'_>,
) -> Result<PluginReportResponse, AppError> {
    let player_count = i32::try_from(report.players.len()).unwrap_or(i32::MAX);
    let mut transaction = db.begin().await?;

    let server = sqlx::query_as::<_, ReportServerRow>(
        r"
        UPDATE servers
        SET status = CASE
                WHEN status = 'maintenance' THEN status
                ELSE 'online'
            END,
            name = COALESCE($6, name),
            map = COALESCE($3, map),
            max_players = COALESCE($4, max_players),
            player_count = $5,
            latency_ms = NULL,
            last_reported_at = now(),
            updated_at = now()
        WHERE plugin_token = $2
          AND ($1::text IS NULL OR id = $1)
        RETURNING id, last_reported_at
        ",
    )
    .bind(report.server_id)
    .bind(report.token)
    .bind(report.map)
    .bind(report.max_players)
    .bind(player_count)
    .bind(report.name)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let steam_ids = report
        .players
        .iter()
        .map(|player| player.steam_id64.clone())
        .collect::<Vec<_>>();
    sqlx::query(
        r"
        DELETE FROM server_players
        WHERE server_id = $1
          AND NOT (steam_id64 = ANY($2))
        ",
    )
    .bind(&server.id)
    .bind(&steam_ids)
    .execute(&mut *transaction)
    .await?;

    for player in report.players {
        sqlx::query(
            r"
            INSERT INTO server_players (
                server_id, user_id, steam_id64, display_name, avatar_url,
                connected_at, last_seen_at
            )
            VALUES (
                $1,
                (SELECT id FROM users WHERE steam_id64 = $2),
                $2, $3,
                (SELECT avatar_url FROM users WHERE steam_id64 = $2),
                $4, now()
            )
            ON CONFLICT (server_id, steam_id64) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                avatar_url = COALESCE(EXCLUDED.avatar_url, server_players.avatar_url),
                user_id = COALESCE(EXCLUDED.user_id, server_players.user_id),
                last_seen_at = now()
            ",
        )
        .bind(&server.id)
        .bind(&player.steam_id64)
        .bind(&player.name)
        .bind(player.connected_at)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    Ok(PluginReportResponse {
        server_id: server.id,
        player_count,
        skipped: report.skipped,
        reported_at: server.last_reported_at,
    })
}

async fn sweep_stale(db: &PgPool, skip_rcon_servers: bool) -> Result<(u64, u64), sqlx::Error> {
    let mut transaction = db.begin().await?;
    let stale_ids = sqlx::query_scalar::<_, String>(
        r"
        SELECT s.id
        FROM servers s
        WHERE s.plugin_token IS NOT NULL
          AND (NOT $2::boolean OR s.rcon_password IS NULL)
          AND (
              s.last_reported_at IS NULL
              OR s.last_reported_at < now() - make_interval(secs => $1::double precision)
          )
          AND (
              s.status NOT IN ('maintenance', 'offline')
              OR s.player_count IS DISTINCT FROM 0
              OR EXISTS (
                  SELECT 1 FROM server_players p WHERE p.server_id = s.id
              )
          )
        FOR UPDATE OF s
        ",
    )
    .bind(f64::from(STALE_AFTER_SECS))
    .bind(skip_rcon_servers)
    .fetch_all(&mut *transaction)
    .await?;

    if stale_ids.is_empty() {
        transaction.commit().await?;
        return Ok((0, 0));
    }

    let updated = sqlx::query(
        r"
        UPDATE servers
        SET status = CASE
                WHEN status = 'maintenance' THEN status
                ELSE 'offline'
            END,
            player_count = 0,
            latency_ms = NULL,
            updated_at = now()
        WHERE id = ANY($1)
        ",
    )
    .bind(&stale_ids)
    .execute(&mut *transaction)
    .await?;

    let deleted = sqlx::query("DELETE FROM server_players WHERE server_id = ANY($1)")
        .bind(&stale_ids)
        .execute(&mut *transaction)
        .await?;

    transaction.commit().await?;
    Ok((updated.rows_affected(), deleted.rows_affected()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn player(steam_id64: &str, name: &str, connected_seconds: Option<i64>) -> PluginPlayer {
        PluginPlayer {
            steam_id64: steam_id64.to_owned(),
            name: name.to_owned(),
            connected_seconds,
        }
    }

    #[test]
    fn normalization_filters_invalid_and_duplicate_steam_ids() {
        let now = Utc::now();
        let input = vec![
            player("76561199125125759", "  玩家\n甲  ", Some(120)),
            player("76561199125125759", "重复", Some(30)),
            player("123", "无效", None),
            player("76561198000000000", "\u{0000}", Some(-5)),
        ];

        let (players, skipped) = normalize_players(&input, now);

        assert_eq!(players.len(), 2);
        assert_eq!(skipped, 2);
        assert_eq!(players[0].steam_id64, "76561199125125759");
        assert_eq!(players[0].name, "玩家 甲");
        assert_eq!(players[0].connected_at, now - ChronoDuration::seconds(120));
        assert_eq!(players[1].name, "76561198000000000");
        assert_eq!(players[1].connected_at, now);
    }

    #[test]
    fn long_names_fit_the_database_limit() {
        let now = Utc::now();
        let input = vec![player("76561198000000003", &"名".repeat(200), None)];

        let (players, skipped) = normalize_players(&input, now);

        assert_eq!(skipped, 0);
        assert_eq!(players[0].name.chars().count(), MAX_NAME_CHARS);
        assert!(players[0].name.ends_with('…'));
    }

    #[test]
    fn connected_seconds_are_clamped() {
        let now = Utc::now();
        let input = vec![
            player("76561198000000001", "长期在线", Some(i64::MAX)),
            player("76561198000000002", "负时间", Some(i64::MIN)),
        ];

        let (players, skipped) = normalize_players(&input, now);
        assert_eq!(skipped, 0);
        assert_eq!(
            players[0].connected_at,
            now - ChronoDuration::seconds(MAX_CONNECTED_SECONDS)
        );
        assert_eq!(players[1].connected_at, now);
    }

    #[test]
    fn maps_are_trimmed_limited_and_stripped_of_controls() {
        assert_eq!(
            normalize_map(Some("  kz_unmake\n  ".to_owned())).unwrap(),
            Some("kz_unmake".to_owned())
        );
        assert_eq!(normalize_map(Some("   ".to_owned())).unwrap(), None);
        assert!(normalize_map(Some("a".repeat(MAX_MAP_CHARS + 1))).is_err());
    }

    #[test]
    fn server_id_is_optional_trimmed_and_limited() {
        assert_eq!(normalize_server_id(None).unwrap(), None);
        assert_eq!(normalize_server_id(Some("   ".to_owned())).unwrap(), None);
        assert_eq!(
            normalize_server_id(Some("  srv-1a2b3c4d5e6f  ".to_owned())).unwrap(),
            Some("srv-1a2b3c4d5e6f".to_owned())
        );
        assert!(normalize_server_id(Some("a".repeat(81))).is_err());
    }

    #[test]
    fn server_name_is_trimmed_limited_and_stripped_of_controls() {
        assert_eq!(
            normalize_server_name(Some("  KZ | 新手服\n ".to_owned())),
            Some("KZ | 新手服".to_owned())
        );
        assert_eq!(normalize_server_name(Some("   ".to_owned())), None);
        assert_eq!(normalize_server_name(None), None);
        let long = normalize_server_name(Some("服".repeat(MAX_SERVER_NAME_CHARS + 10)))
            .expect("non-empty name");
        assert_eq!(long.chars().count(), MAX_SERVER_NAME_CHARS);
        assert!(long.ends_with('…'));
    }

    #[test]
    fn max_players_is_validated() {
        assert!(validate_max_players(Some(10)).is_ok());
        assert!(validate_max_players(None).is_ok());
        assert!(validate_max_players(Some(0)).is_err());
        assert!(validate_max_players(Some(1025)).is_err());
    }

    #[test]
    fn tokens_require_the_exact_header() {
        let mut headers = HeaderMap::new();
        assert!(plugin_token(&headers).is_err());
        headers.insert(TOKEN_HEADER, "   ".parse().unwrap());
        assert!(plugin_token(&headers).is_err());
        headers.insert(TOKEN_HEADER, "abc".parse().unwrap());
        assert_eq!(plugin_token(&headers).unwrap(), "abc");
    }
}
