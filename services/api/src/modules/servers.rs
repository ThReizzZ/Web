use std::{convert::Infallible, time::Duration};

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderName, HeaderValue, header},
    response::{
        IntoResponse, Response,
        sse::{Event, KeepAlive, Sse},
    },
    routing::get,
};
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use serde::Serialize;
use sqlx::FromRow;
use tokio_stream::wrappers::{BroadcastStream, errors::BroadcastStreamRecvError};

use crate::{errors::AppError, state::AppState};

#[derive(Debug, Serialize, FromRow)]
pub struct ServerRow {
    pub id: String,
    pub name: String,
    pub map: String,
    pub description: String,
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
    pub requires_whitelist: bool,
    pub player_count: Option<i32>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ServerPlayerRow {
    pub server_id: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub connected_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerPlayer {
    pub name: String,
    pub avatar_url: Option<String>,
    pub connected_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Server {
    pub id: String,
    pub name: String,
    pub map: String,
    pub description: String,
    pub community: String,
    pub status: String,
    pub ip: String,
    pub port: i32,
    pub region: String,
    pub tickrate: i32,
    pub max_players: i32,
    pub latency_ms: Option<i32>,
    pub tags: Vec<String>,
    pub map_image: String,
    pub featured: bool,
    pub requires_whitelist: bool,
    pub player_count: Option<i32>,
    pub players: Vec<ServerPlayer>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/servers", get(list_servers))
        .route("/servers/stream", get(stream_servers))
}

/// Streams a lightweight event whenever a plugin report updates a server.
/// Clients respond by refetching `/servers`, which keeps the SSE frame small
/// and avoids duplicating the full server serialization in the API.
async fn stream_servers(State(state): State<AppState>) -> Response {
    let receiver = state.server_updates.subscribe();
    let stream = BroadcastStream::new(receiver).filter_map(|message| async move {
        match message {
            Ok(server_id) => Some(Ok::<_, Infallible>(
                Event::default().event("server-update").data(server_id),
            )),
            Err(BroadcastStreamRecvError::Lagged(skipped)) => {
                tracing::warn!(skipped, "server update stream lagged");
                Some(Ok(Event::default().event("server-update").data("refresh")))
            }
        }
    });

    let mut response = Sse::new(stream)
        .keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(15))
                .text("keep-alive"),
        )
        .into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    response.headers_mut().insert(
        HeaderName::from_static("x-accel-buffering"),
        HeaderValue::from_static("no"),
    );
    response
}

#[utoipa::path(
    get,
    path = "/api/v1/servers",
    tag = "servers",
    responses((status = 200, description = "Active servers with their current players"))
)]
async fn list_servers(State(state): State<AppState>) -> Result<Json<Vec<Server>>, AppError> {
    let rows = sqlx::query_as::<_, ServerRow>(
        r"
        SELECT s.id, s.name, s.map, s.description,
               coalesce(c.name, '') AS community, s.status, s.host, s.port, s.region,
               s.tickrate, s.max_players, s.latency_ms, s.tags, s.map_image, s.featured,
               s.requires_whitelist, s.player_count
        FROM servers s
        LEFT JOIN server_communities c ON c.id = s.community_id
        WHERE s.is_active = true
        ORDER BY s.sort_order, s.name
        ",
    )
    .fetch_all(&state.db)
    .await?;

    let ids = rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
    let players = sqlx::query_as::<_, ServerPlayerRow>(
        r"
        SELECT server_id, display_name, avatar_url, connected_at
        FROM server_players
        WHERE server_id = ANY($1) AND last_seen_at > now() - interval '5 minutes'
        ORDER BY connected_at
        ",
    )
    .bind(&ids)
    .fetch_all(&state.db)
    .await?;

    let servers = rows
        .into_iter()
        .map(|row| {
            let roster = players
                .iter()
                .filter(|player| player.server_id == row.id)
                .map(|player| ServerPlayer {
                    name: player.display_name.clone(),
                    avatar_url: player.avatar_url.clone(),
                    connected_at: player.connected_at,
                })
                .collect();
            Server {
                id: row.id,
                name: row.name,
                map: row.map,
                description: row.description,
                community: row.community,
                status: row.status,
                ip: row.host,
                port: row.port,
                region: row.region,
                tickrate: row.tickrate,
                max_players: row.max_players,
                latency_ms: row.latency_ms,
                tags: row.tags,
                map_image: row.map_image,
                featured: row.featured,
                requires_whitelist: row.requires_whitelist,
                player_count: row.player_count,
                players: roster,
            }
        })
        .collect();

    Ok(Json(servers))
}
