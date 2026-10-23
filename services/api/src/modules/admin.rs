use axum::{Json, Router, extract::State, http::HeaderMap, routing::get};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;

use crate::{
    errors::AppError,
    modules::{
        auth::require_admin,
        forum::{TopicQuery, TopicSummary, fetch_topics},
    },
    state::AppState,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminStats {
    pub members: i64,
    pub active_today: i64,
    pub topics: i64,
    pub replies: i64,
    pub servers: i64,
    pub online_players: i64,
    pub pending_whitelist: i64,
    pub active_bans: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RoleCount {
    pub role: String,
    pub count: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RecentUser {
    pub steam_id64: String,
    pub name: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyActivity {
    pub date: String,
    pub users: i64,
    pub topics: i64,
    pub replies: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminOverview {
    pub stats: AdminStats,
    pub roles: Vec<RoleCount>,
    pub recent_users: Vec<RecentUser>,
    pub recent_topics: Vec<TopicSummary>,
    pub weekly_activity: Vec<WeeklyActivity>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/admin/overview", get(overview))
}

#[utoipa::path(
    get,
    path = "/api/v1/admin/overview",
    tag = "admin",
    responses((status = 200, description = "Admin overview computed from the database"), (status = 403, description = "Admin role required"))
)]
async fn overview(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<AdminOverview>, AppError> {
    require_admin(&state, &headers).await?;

    let admin_stats = sqlx::query_as::<_, AdminStats>(
        r"
        SELECT
            (SELECT count(*) FROM users WHERE is_system = false)::bigint AS members,
            (SELECT count(*) FROM users WHERE is_system = false AND is_disabled = false AND last_login_at >= current_date)::bigint AS active_today,
            (SELECT count(*) FROM topics WHERE deleted_at IS NULL)::bigint AS topics,
            (SELECT count(*) FROM replies WHERE deleted_at IS NULL)::bigint AS replies,
            (SELECT count(*) FROM servers WHERE is_active = true)::bigint AS servers,
            (SELECT count(*) FROM server_players
             WHERE last_seen_at > now() - interval '5 minutes')::bigint AS online_players,
            (SELECT count(*) FROM whitelist_applications
             WHERE status = 'pending')::bigint AS pending_whitelist,
            (SELECT count(*) FROM bans
             WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()))::bigint AS active_bans
        ",
    )
    .fetch_one(&state.db)
    .await?;

    let roles = sqlx::query_as::<_, RoleCount>(
        "SELECT role, count(*)::bigint AS count FROM users WHERE is_system = false GROUP BY role ORDER BY count DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let recent_users = sqlx::query_as::<_, RecentUser>(
        r"
        SELECT steam_id64, persona_name AS name, role, avatar_url, created_at, last_login_at
        FROM users
        WHERE is_system = false
        ORDER BY created_at DESC
        LIMIT 8
        ",
    )
    .fetch_all(&state.db)
    .await?;

    let recent_topics = fetch_topics(
        &state,
        TopicQuery {
            limit: Some(6),
            category: None,
            q: None,
            author: None,
        },
    )
    .await?;

    let weekly_activity = sqlx::query_as::<_, WeeklyActivity>(
        r"
        WITH days AS (
            SELECT generate_series(current_date - interval '6 days', current_date, interval '1 day')::date AS day
        )
        SELECT to_char(d.day, 'MM-DD') AS date,
               (SELECT count(*) FROM users u WHERE u.is_system = false AND u.created_at::date = d.day)::bigint AS users,
               (SELECT count(*) FROM topics t WHERE t.created_at::date = d.day AND t.deleted_at IS NULL)::bigint AS topics,
               (SELECT count(*) FROM replies r WHERE r.created_at::date = d.day AND r.deleted_at IS NULL)::bigint AS replies
        FROM days d
        ORDER BY d.day
        ",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(AdminOverview {
        stats: admin_stats,
        roles,
        recent_users,
        recent_topics,
        weekly_activity,
    }))
}
