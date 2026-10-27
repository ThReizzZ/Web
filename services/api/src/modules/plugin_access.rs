//! Plugin-facing access control and moderation queue.
//!
//! `ThRei_Players` polls these endpoints with the same per-server token used
//! for reports. The wire format is deliberately plain text: the plugin does
//! not need a JSON library or the `RIPExt` dependency, and every line is easy
//! to validate with `SourceMod` string helpers.
//!
//! The access snapshot is generated from the database, so approving a
//! whitelist application or adding a ban takes effect on the game server after
//! one plugin polling interval. Kick/ban commands are consumed through the
//! action queue; clients may long-poll `/plugin/actions?wait=20`, so a new
//! command is normally delivered in about a second. The plugin acknowledges
//! each action, which keeps execution idempotent even when the server is
//! unreachable for a while.

use std::time::Duration;

use axum::{
    Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use sqlx::FromRow;
use tokio::time::{Instant, sleep};
use uuid::Uuid;

use crate::{errors::AppError, modules::server_plugin::plugin_token, state::AppState};

const MAX_SNAPSHOT_ENTRIES: i64 = 10_000;
const MAX_PENDING_ACTIONS: i64 = 100;
const MAX_REASON_CHARS: usize = 400;
const MAX_ACTION_WAIT_SECS: u64 = 20;
const ACTION_POLL_INTERVAL_MS: u64 = 250;
const TEXT_CONTENT_TYPE: &str = "text/plain; charset=utf-8";

#[derive(Debug, Deserialize)]
struct ActionsQuery {
    /// Long-poll wait in seconds. Zero keeps the legacy immediate response.
    #[serde(default)]
    wait: Option<u64>,
}

#[derive(Debug, FromRow)]
struct AccessServerRow {
    id: String,
    requires_whitelist: bool,
}

#[derive(Debug, FromRow)]
struct WhitelistRow {
    steam_id64: String,
}

#[derive(Debug, FromRow)]
struct BanRow {
    steam_id64: String,
    reason: String,
    expires_at_unix: i64,
}

#[derive(Debug, FromRow)]
struct ActionRow {
    id: Uuid,
    action: String,
    steam_id64: String,
    reason: String,
    expires_at_unix: i64,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/plugin/access-snapshot", get(access_snapshot))
        .route("/plugin/actions", get(actions))
        .route("/plugin/actions/{id}/ack", post(ack_action))
}

#[utoipa::path(
    get,
    path = "/api/v1/plugin/access-snapshot",
    tag = "plugin",
    params(
        ("x-threi-plugin-token" = String, Header, description = "Per-server plugin token generated in the admin panel")
    ),
    responses(
        (status = 200, description = "Plain-text whitelist and ban snapshot"),
        (status = 401, description = "Missing or invalid plugin token", body = crate::errors::ErrorResponse)
    )
)]
async fn access_snapshot(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let token = plugin_token(&headers)?;

    let server = sqlx::query_as::<_, AccessServerRow>(
        "SELECT id, requires_whitelist FROM servers WHERE plugin_token = $1",
    )
    .bind(token)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let whitelist = sqlx::query_as::<_, WhitelistRow>(
        r"
        SELECT steam_id64
        FROM global_whitelist
        ORDER BY steam_id64
        LIMIT $1
        ",
    )
    .bind(MAX_SNAPSHOT_ENTRIES)
    .fetch_all(&state.db)
    .await?;

    let bans = sqlx::query_as::<_, BanRow>(
        r"
        SELECT
            steam_id64,
            reason,
            COALESCE(EXTRACT(EPOCH FROM expires_at)::bigint, 0) AS expires_at_unix
        FROM server_bans
        WHERE (server_id = $1 OR server_id IS NULL)
          AND lifted_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY steam_id64
        LIMIT $2
        ",
    )
    .bind(&server.id)
    .bind(MAX_SNAPSHOT_ENTRIES)
    .fetch_all(&state.db)
    .await?;

    let body = render_access_snapshot(&server, &whitelist, &bans);
    Ok(text_response(body))
}

#[utoipa::path(
    get,
    path = "/api/v1/plugin/actions",
    tag = "plugin",
    params(
        ("x-threi-plugin-token" = String, Header, description = "Per-server plugin token generated in the admin panel"),
        ("wait" = Option<u64>, Query, description = "Long-poll wait in seconds, capped at 20")
    ),
    responses(
        (status = 200, description = "Plain-text pending kick/ban actions"),
        (status = 401, description = "Missing or invalid plugin token", body = crate::errors::ErrorResponse)
    )
)]
async fn actions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ActionsQuery>,
) -> Result<Response, AppError> {
    let token = plugin_token(&headers)?;
    let server_id = server_id_for_token(&state, token).await?;
    let wait_secs = query.wait.unwrap_or(0).min(MAX_ACTION_WAIT_SECS);
    let deadline = Instant::now() + Duration::from_secs(wait_secs);

    loop {
        let actions = sqlx::query_as::<_, ActionRow>(
            r"
            SELECT
                a.id,
                a.action,
                a.steam_id64,
                a.reason,
                COALESCE((
                    SELECT EXTRACT(EPOCH FROM b.expires_at)::bigint
                    FROM server_bans b
                    WHERE (b.server_id = a.server_id OR b.server_id IS NULL)
                      AND b.steam_id64 = a.steam_id64
                      AND b.lifted_at IS NULL
                    ORDER BY b.created_at DESC
                    LIMIT 1
                ), 0) AS expires_at_unix
            FROM server_actions a
            WHERE a.server_id = $1
              AND a.processed_at IS NULL
            ORDER BY a.created_at
            LIMIT $2
            ",
        )
        .bind(&server_id)
        .bind(MAX_PENDING_ACTIONS)
        .fetch_all(&state.db)
        .await?;

        if !actions.is_empty() || wait_secs == 0 || Instant::now() >= deadline {
            return Ok(text_response(render_actions(&actions)));
        }

        sleep(Duration::from_millis(ACTION_POLL_INTERVAL_MS)).await;
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/plugin/actions/{id}/ack",
    tag = "plugin",
    params(
        ("x-threi-plugin-token" = String, Header, description = "Per-server plugin token generated in the admin panel"),
        ("id" = String, Path, description = "Action id returned by the action poll")
    ),
    responses(
        (status = 204, description = "Action acknowledged"),
        (status = 401, description = "Missing or invalid plugin token", body = crate::errors::ErrorResponse),
        (status = 404, description = "Action does not belong to this server", body = crate::errors::ErrorResponse)
    )
)]
async fn ack_action(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let token = plugin_token(&headers)?;
    let server_id = server_id_for_token(&state, token).await?;

    let result = sqlx::query(
        r"
        UPDATE server_actions
        SET processed_at = COALESCE(processed_at, now())
        WHERE id = $1
          AND server_id = $2
        ",
    )
    .bind(id)
    .bind(server_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Resolve the token before querying server-scoped data so an invalid token is
/// always `401`, even when the server happens to have no pending actions.
async fn server_id_for_token(state: &AppState, token: &str) -> Result<String, AppError> {
    sqlx::query_scalar::<_, String>("SELECT id FROM servers WHERE plugin_token = $1")
        .bind(token)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)
}

fn text_response(body: String) -> Response {
    (
        [
            (header::CONTENT_TYPE, TEXT_CONTENT_TYPE),
            (header::CACHE_CONTROL, "no-store"),
        ],
        body,
    )
        .into_response()
}

fn render_access_snapshot(
    server: &AccessServerRow,
    whitelist: &[WhitelistRow],
    bans: &[BanRow],
) -> String {
    let mut body = String::with_capacity(80 + (whitelist.len() + bans.len()) * 32);
    body.push_str("# ThRei access snapshot v1\n");
    body.push_str("server ");
    body.push_str(&server.id);
    body.push('\n');
    body.push_str("requires_whitelist ");
    body.push_str(if server.requires_whitelist { "1" } else { "0" });
    body.push('\n');

    for entry in whitelist {
        body.push_str("whitelist ");
        body.push_str(&entry.steam_id64);
        body.push('\n');
    }
    for ban in bans {
        body.push_str("ban ");
        body.push_str(&ban.steam_id64);
        body.push(' ');
        body.push_str(&ban.expires_at_unix.to_string());
        body.push(' ');
        body.push_str(&one_line_reason(&ban.reason));
        body.push('\n');
    }

    body
}

fn render_actions(actions: &[ActionRow]) -> String {
    let mut body = String::with_capacity(32 + actions.len() * 96);
    body.push_str("# ThRei actions v1\n");
    for action in actions {
        body.push_str("action ");
        body.push_str(&action.id.to_string());
        body.push(' ');
        body.push_str(&action.action);
        body.push(' ');
        body.push_str(&action.steam_id64);
        body.push(' ');
        // Bans carry an expiry so the plugin can refuse an action that raced
        // with a lift/expiry and enforce temporary bans locally. Kick actions
        // keep the shorter four-field form.
        if action.action == "ban" {
            body.push_str(&action.expires_at_unix.to_string());
            body.push(' ');
        }
        body.push_str(&one_line_reason(&action.reason));
        body.push('\n');
    }
    body
}

/// Reasons come from the admin panel and are shown in the game console and
/// kick dialog. Flatten control characters so a reason can never inject an
/// extra protocol line, and cap the length to fit the plugin's line buffer.
fn one_line_reason(value: &str) -> String {
    value
        .chars()
        .take(MAX_REASON_CHARS)
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect::<String>()
        .trim()
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn server(requires_whitelist: bool) -> AccessServerRow {
        AccessServerRow {
            id: "srv-test".to_owned(),
            requires_whitelist,
        }
    }

    #[test]
    fn snapshot_contains_header_whitelist_and_permanent_ban() {
        let whitelist = vec![WhitelistRow {
            steam_id64: "76561199125125759".to_owned(),
        }];
        let bans = vec![BanRow {
            steam_id64: "76561198000000000".to_owned(),
            reason: "  作弊\n换行  ".to_owned(),
            expires_at_unix: 0,
        }];

        let body = render_access_snapshot(&server(true), &whitelist, &bans);

        assert_eq!(
            body,
            "# ThRei access snapshot v1\nserver srv-test\nrequires_whitelist 1\nwhitelist 76561199125125759\nban 76561198000000000 0 作弊 换行\n"
        );
    }

    #[test]
    fn disabled_whitelist_is_rendered_as_zero() {
        let body = render_access_snapshot(&server(false), &[], &[]);
        assert!(body.contains("requires_whitelist 0\n"));
        assert!(!body.lines().any(|line| line.starts_with("whitelist ")));
    }

    #[test]
    fn action_ids_and_actions_are_rendered_one_per_line() {
        let actions = vec![
            ActionRow {
                id: Uuid::nil(),
                action: "kick".to_owned(),
                steam_id64: "76561199125125759".to_owned(),
                reason: "测试".to_owned(),
                expires_at_unix: 0,
            },
            ActionRow {
                id: Uuid::from_u128(1),
                action: "ban".to_owned(),
                steam_id64: "76561198000000000".to_owned(),
                reason: "刷屏".to_owned(),
                expires_at_unix: 1_800_000_000,
            },
        ];

        let body = render_actions(&actions);

        assert_eq!(
            body,
            "# ThRei actions v1\naction 00000000-0000-0000-0000-000000000000 kick 76561199125125759 测试\naction 00000000-0000-0000-0000-000000000001 ban 76561198000000000 1800000000 刷屏\n"
        );
    }

    #[test]
    fn reasons_are_flattened_and_limited() {
        let reason = format!("{}\nadmin 123", "x".repeat(MAX_REASON_CHARS + 20));
        let rendered = one_line_reason(&reason);
        assert_eq!(rendered.chars().count(), MAX_REASON_CHARS);
        assert!(!rendered.contains('\n'));
    }
}
