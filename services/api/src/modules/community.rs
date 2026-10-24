use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;
use sqlx::FromRow;

use crate::{errors::AppError, state::AppState};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CommunityStats {
    pub members: i64,
    pub topics: i64,
    pub replies: i64,
    pub online_players: i64,
    pub servers: i64,
    pub new_topics_week: i64,
    pub active_members_week: i64,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/community/overview", get(overview))
}

#[utoipa::path(
    get,
    path = "/api/v1/community/overview",
    tag = "community",
    responses((status = 200, description = "Community-wide database counts"))
)]
async fn overview(State(state): State<AppState>) -> Result<Json<CommunityStats>, AppError> {
    let counts = sqlx::query_as::<_, CommunityStats>(
        r"
        SELECT
            (SELECT count(*) FROM users WHERE is_system = false)::bigint AS members,
            (SELECT count(*) FROM topics WHERE deleted_at IS NULL)::bigint AS topics,
            (SELECT count(*) FROM replies WHERE deleted_at IS NULL)::bigint AS replies,
            (SELECT count(*) FROM server_players
             WHERE last_seen_at > now() - interval '5 minutes')::bigint AS online_players,
            (SELECT count(*) FROM servers WHERE is_active = true)::bigint AS servers,
            (SELECT count(*) FROM topics
             WHERE deleted_at IS NULL AND created_at >= date_trunc('week', now()))::bigint AS new_topics_week,
            (SELECT count(DISTINCT activity.author_id) FROM (
                SELECT author_id, created_at FROM topics WHERE deleted_at IS NULL
                UNION ALL
                SELECT author_id, created_at FROM replies WHERE deleted_at IS NULL
            ) activity
             JOIN users u ON u.id = activity.author_id
             WHERE u.is_system = false
               AND activity.created_at >= date_trunc('week', now()))::bigint AS active_members_week
        ",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(counts))
}
