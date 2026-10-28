use axum::{
    Json, Router,
    extract::State,
    http::HeaderMap,
    routing::{get, patch},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{
    errors::AppError,
    modules::{
        auth::{AuthUser, MeUser, require_user},
        forum::{TopicQuery, TopicSummary, fetch_topics},
    },
    state::AppState,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccountStats {
    pub topics: i64,
    pub replies: i64,
    pub favorites: i64,
    pub sessions: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteServer {
    pub id: String,
    pub name: String,
    pub map: String,
    pub status: String,
    pub online_players: i64,
    pub max_players: i32,
    pub map_image: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ActivityRow {
    pub kind: String,
    pub title: String,
    pub detail: String,
    pub created_at: DateTime<Utc>,
    pub href: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub kind: String,
    pub title: String,
    pub detail: String,
    pub created_at: DateTime<Utc>,
    pub href: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWhitelist {
    pub whitelisted: bool,
    pub pending: bool,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccountGameBan {
    /// `global`, `server`, or `ip`.
    pub scope: String,
    pub server_name: String,
    pub reason: String,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountOverview {
    pub user: MeUser,
    pub stats: AccountStats,
    pub whitelist: AccountWhitelist,
    pub game_bans: Vec<AccountGameBan>,
    pub recent_topics: Vec<TopicSummary>,
    pub favorites: Vec<FavoriteServer>,
    pub recent_activity: Vec<Activity>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileRequest {
    pub bio: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/account", get(account_overview))
        .route("/account/profile", patch(update_profile))
}

#[utoipa::path(
    get,
    path = "/api/v1/account",
    tag = "account",
    responses((status = 200, description = "Current user's account overview"), (status = 401, description = "Authentication required"))
)]
async fn account_overview(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<AccountOverview>, AppError> {
    let user = require_user(&state, &headers).await?;
    let overview = build_overview(&state, &user).await?;
    Ok(Json(overview))
}

#[utoipa::path(
    patch,
    path = "/api/v1/account/profile",
    tag = "account",
    request_body = UpdateProfileRequest,
    responses((status = 200, description = "Updated profile"), (status = 401, description = "Authentication required"), (status = 422, description = "Invalid profile data"))
)]
async fn update_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<UpdateProfileRequest>,
) -> Result<Json<MeUser>, AppError> {
    let user = require_user(&state, &headers).await?;

    let bio = request.bio.trim();
    if bio.chars().count() > 2000 {
        return Err(AppError::validation("bio must be at most 2000 characters"));
    }

    let updated = sqlx::query_as::<_, AuthUser>(
        r"
        UPDATE users
        SET bio = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, steam_id64, persona_name, avatar_url, role, bio, location,
                  is_disabled, created_at, last_login_at
        ",
    )
    .bind(user.id)
    .bind(bio)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(MeUser::from(updated)))
}

#[allow(clippy::too_many_lines)]
pub(crate) async fn build_overview(
    state: &AppState,
    user: &AuthUser,
) -> Result<AccountOverview, AppError> {
    let account_stats = sqlx::query_as::<_, AccountStats>(
        r"
        SELECT
            (SELECT count(*) FROM topics WHERE author_id = $1 AND deleted_at IS NULL)::bigint AS topics,
            (SELECT count(*) FROM replies WHERE author_id = $1 AND deleted_at IS NULL)::bigint AS replies,
            (SELECT count(*) FROM favorites WHERE user_id = $1)::bigint AS favorites,
            (SELECT count(*) FROM sessions WHERE user_id = $1 AND expires_at > now())::bigint AS sessions
        ",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    let recent_topics = fetch_topics(
        state,
        TopicQuery {
            limit: Some(5),
            category: None,
            q: None,
            author: Some(user.id),
        },
    )
    .await?;

    let favorites = sqlx::query_as::<_, FavoriteServer>(
        r"
        SELECT s.id, s.name, s.map, s.status,
               (SELECT count(*) FROM server_players p
                WHERE p.server_id = s.id AND p.last_seen_at > now() - interval '5 minutes')::bigint AS online_players,
               s.max_players, s.map_image
        FROM favorites f
        JOIN servers s ON s.id = f.server_id
        WHERE f.user_id = $1 AND s.is_active = true
        ORDER BY f.created_at DESC
        ",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let activity = sqlx::query_as::<_, ActivityRow>(
        r"
        SELECT 'topic' AS kind, t.title, t.excerpt AS detail, t.created_at,
               '/forum/topic/' || t.slug AS href
        FROM topics t
        WHERE t.author_id = $1 AND t.deleted_at IS NULL
        UNION ALL
        SELECT 'reply' AS kind, t.title, r.content AS detail, r.created_at,
               '/forum/topic/' || t.slug AS href
        FROM replies r
        JOIN topics t ON t.id = r.topic_id
        WHERE r.author_id = $1 AND r.deleted_at IS NULL AND t.deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
        ",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let (whitelisted, pending) = sqlx::query_as::<_, (bool, bool)>(
        r"
        SELECT
            EXISTS (SELECT 1 FROM global_whitelist WHERE steam_id64 = $1) AS whitelisted,
            EXISTS (
                SELECT 1 FROM whitelist_applications
                WHERE steam_id64 = $1 AND status = 'pending'
            ) AS pending
        ",
    )
    .bind(&user.steam_id64)
    .fetch_one(&state.db)
    .await?;

    let game_bans = sqlx::query_as::<_, AccountGameBan>(
        r"
        SELECT
            CASE WHEN b.server_id IS NULL THEN 'global' ELSE 'server' END AS scope,
            coalesce(s.name, '全服') AS server_name,
            b.reason,
            b.expires_at
        FROM server_bans b
        LEFT JOIN servers s ON s.id = b.server_id
        WHERE b.steam_id64 = $1
          AND b.lifted_at IS NULL
          AND (b.expires_at IS NULL OR b.expires_at > now())
        UNION ALL
        SELECT 'ip' AS scope, 'IP 封禁' AS server_name, b.reason, b.expires_at
        FROM server_ip_bans b
        WHERE b.ip_address = (SELECT last_login_ip FROM users WHERE id = $2)
          AND b.lifted_at IS NULL
          AND (b.expires_at IS NULL OR b.expires_at > now())
        ORDER BY expires_at DESC NULLS FIRST
        ",
    )
    .bind(&user.steam_id64)
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    Ok(AccountOverview {
        user: MeUser::from(user.clone()),
        stats: account_stats,
        whitelist: AccountWhitelist {
            whitelisted,
            pending,
        },
        game_bans,
        recent_topics,
        favorites,
        recent_activity: activity
            .into_iter()
            .map(|item| Activity {
                kind: item.kind,
                title: item.title,
                detail: item.detail,
                created_at: item.created_at,
                href: item.href,
            })
            .collect(),
    })
}
