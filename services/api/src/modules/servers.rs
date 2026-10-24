use axum::{Json, Router, extract::State, routing::get};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;

use crate::{errors::AppError, state::AppState};

#[derive(Debug, Serialize, FromRow)]
pub struct ServerRow {
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
    Router::new().route("/servers", get(list_servers))
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
        SELECT id, name, map, description, status, host, port, region, tickrate,
               max_players, latency_ms, tags, map_image, featured, requires_whitelist,
               player_count
        FROM servers
        WHERE is_active = true
        ORDER BY featured DESC, name
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
