use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, patch, post},
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{errors::AppError, modules::auth::require_admin, state::AppState};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminTopic {
    pub slug: String,
    pub title: String,
    pub excerpt: String,
    pub content: String,
    pub category_slug: String,
    pub category_name: String,
    pub author_name: String,
    pub author_role: String,
    pub author_avatar_url: Option<String>,
    pub tags: Vec<String>,
    pub views: i64,
    pub pinned: bool,
    pub hot: bool,
    pub created_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub reply_count: i64,
    pub deleted_at: Option<DateTime<Utc>>,
    pub is_deleted: bool,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminReply {
    pub id: uuid::Uuid,
    pub topic_slug: String,
    pub topic_title: String,
    pub content: String,
    pub author_name: String,
    pub author_role: String,
    pub author_avatar_url: Option<String>,
    pub likes: i32,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub is_deleted: bool,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminForumUser {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub is_disabled: bool,
    pub is_banned: bool,
    pub is_muted: bool,
    pub mute_reason: Option<String>,
    pub muted_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTopicRequest {
    pub title: String,
    pub excerpt: String,
    pub content: String,
    pub category_slug: String,
    pub tags: Vec<String>,
    pub pinned: bool,
    pub hot: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateReplyRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MuteRequest {
    pub reason: String,
    pub expires_in_hours: Option<i64>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/forum/topics", get(list_topics))
        .route(
            "/admin/forum/topics/{slug}",
            patch(update_topic).delete(delete_topic),
        )
        .route("/admin/forum/topics/{slug}/restore", post(restore_topic))
        .route("/admin/forum/replies", get(list_replies))
        .route(
            "/admin/forum/replies/{id}",
            patch(update_reply).delete(delete_reply),
        )
        .route("/admin/forum/replies/{id}/restore", post(restore_reply))
        .route("/admin/forum/users", get(list_users))
        .route(
            "/admin/forum/users/{steam_id64}/mute",
            post(mute_user).delete(unmute_user),
        )
}

async fn list_topics(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminTopic>>, AppError> {
    require_admin(&state, &headers).await?;
    let topics = sqlx::query_as::<_, AdminTopic>(
        r"
        SELECT t.slug, t.title, t.excerpt, t.content, c.slug AS category_slug,
               c.name AS category_name, u.persona_name AS author_name,
               u.role AS author_role, u.avatar_url AS author_avatar_url,
               t.tags, t.views, t.pinned, t.hot, t.created_at, t.last_activity_at,
               (SELECT count(*) FROM replies r WHERE r.topic_id = t.id)::bigint AS reply_count,
               t.deleted_at, (t.deleted_at IS NOT NULL) AS is_deleted
        FROM topics t
        JOIN categories c ON c.slug = t.category_slug
        JOIN users u ON u.id = t.author_id
        ORDER BY (t.deleted_at IS NULL) DESC, t.pinned DESC, t.last_activity_at DESC
        ",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(topics))
}

async fn update_topic(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    Json(request): Json<UpdateTopicRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let title = request.title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(AppError::Validation(
            "title must be between 1 and 200 characters".to_owned(),
        ));
    }
    if request.content.trim().is_empty() || request.content.chars().count() > 100_000 {
        return Err(AppError::Validation(
            "content is required and must be at most 100000 characters".to_owned(),
        ));
    }
    let category_exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM categories WHERE slug = $1)")
            .bind(&request.category_slug)
            .fetch_one(&state.db)
            .await?;
    if !category_exists {
        return Err(AppError::Validation("category does not exist".to_owned()));
    }
    let result = sqlx::query(
        r"
        UPDATE topics SET title = $2, excerpt = $3, content = $4, category_slug = $5,
                          tags = $6, pinned = $7, hot = $8, last_activity_at = now()
        WHERE slug = $1
        ",
    )
    .bind(&slug)
    .bind(title)
    .bind(request.excerpt.trim())
    .bind(&request.content)
    .bind(&request.category_slug)
    .bind(&request.tags)
    .bind(request.pinned)
    .bind(request.hot)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_topic(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result = sqlx::query(
        "UPDATE topics SET deleted_at = now(), last_activity_at = now() WHERE slug = $1 AND deleted_at IS NULL",
    )
    .bind(slug)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn restore_topic(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result = sqlx::query(
        "UPDATE topics SET deleted_at = NULL, last_activity_at = now() WHERE slug = $1 AND deleted_at IS NOT NULL",
    )
    .bind(slug)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn list_replies(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminReply>>, AppError> {
    require_admin(&state, &headers).await?;
    let replies = sqlx::query_as::<_, AdminReply>(
        r"
        SELECT r.id, t.slug AS topic_slug, t.title AS topic_title, r.content,
               u.persona_name AS author_name, u.role AS author_role,
               u.avatar_url AS author_avatar_url, r.likes, r.created_at,
               r.deleted_at, (r.deleted_at IS NOT NULL) AS is_deleted
        FROM replies r
        JOIN topics t ON t.id = r.topic_id
        JOIN users u ON u.id = r.author_id
        ORDER BY (r.deleted_at IS NULL) DESC, r.created_at DESC
        LIMIT 100
        ",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(replies))
}

async fn update_reply(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<uuid::Uuid>,
    Json(request): Json<UpdateReplyRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let content = request.content.trim();
    if content.is_empty() || content.chars().count() > 20_000 {
        return Err(AppError::Validation(
            "content must be between 1 and 20000 characters".to_owned(),
        ));
    }
    let result = sqlx::query("UPDATE replies SET content = $2 WHERE id = $1")
        .bind(id)
        .bind(content)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_reply(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<uuid::Uuid>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result =
        sqlx::query("UPDATE replies SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&state.db)
            .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn restore_reply(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<uuid::Uuid>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result = sqlx::query(
        "UPDATE replies SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL",
    )
    .bind(id)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn list_users(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminForumUser>>, AppError> {
    require_admin(&state, &headers).await?;
    let users = sqlx::query_as::<_, AdminForumUser>(
        r"
        SELECT u.steam_id64, u.persona_name AS name, u.avatar_url, u.role,
               u.is_disabled,
               EXISTS (
                   SELECT 1 FROM bans b
                   WHERE b.steam_id64 = u.steam_id64 AND b.lifted_at IS NULL
                     AND (b.expires_at IS NULL OR b.expires_at > now())
               ) AS is_banned,
               EXISTS (
                   SELECT 1 FROM forum_mutes m
                   WHERE m.steam_id64 = u.steam_id64 AND m.lifted_at IS NULL
                     AND (m.expires_at IS NULL OR m.expires_at > now())
               ) AS is_muted,
               (SELECT reason FROM forum_mutes m
                WHERE m.steam_id64 = u.steam_id64 AND m.lifted_at IS NULL
                  AND (m.expires_at IS NULL OR m.expires_at > now())
                ORDER BY m.created_at DESC LIMIT 1) AS mute_reason,
               (SELECT expires_at FROM forum_mutes m
                WHERE m.steam_id64 = u.steam_id64 AND m.lifted_at IS NULL
                  AND (m.expires_at IS NULL OR m.expires_at > now())
                ORDER BY m.created_at DESC LIMIT 1) AS muted_until,
               u.created_at, u.last_login_at
        FROM users u
        WHERE u.is_system = false
        ORDER BY u.last_login_at DESC
        ",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(users))
}

async fn mute_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(steam_id64): Path<String>,
    Json(request): Json<MuteRequest>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&steam_id64)?;
    let target = sqlx::query_as::<_, (String, bool)>(
        "SELECT role, is_system FROM users WHERE steam_id64 = $1",
    )
    .bind(&steam_id64)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    if target.1 || target.0 == "admin" {
        return Err(AppError::Forbidden);
    }
    let reason = request.reason.trim();
    if reason.is_empty() || reason.chars().count() > 1000 {
        return Err(AppError::Validation(
            "reason must be between 1 and 1000 characters".to_owned(),
        ));
    }
    let already_muted = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM forum_mutes WHERE steam_id64 = $1 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()))",
    )
    .bind(&steam_id64)
    .fetch_one(&state.db)
    .await?;
    if already_muted {
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
    sqlx::query(
        "INSERT INTO forum_mutes (steam_id64, reason, expires_at, created_by) VALUES ($1, $2, $3, $4)",
    )
    .bind(steam_id64)
    .bind(reason)
    .bind(expires_at)
    .bind(admin.id)
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn unmute_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(steam_id64): Path<String>,
) -> Result<StatusCode, AppError> {
    let admin = require_admin(&state, &headers).await?;
    let steam_id64 = validate_steam_id(&steam_id64)?;
    let result = sqlx::query(
        "UPDATE forum_mutes SET lifted_at = now(), lifted_by = $2 WHERE steam_id64 = $1 AND lifted_at IS NULL",
    )
    .bind(steam_id64)
    .bind(admin.id)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict);
    }
    Ok(StatusCode::NO_CONTENT)
}

fn validate_steam_id(value: &str) -> Result<String, AppError> {
    if value.len() != 17 || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(AppError::Validation(
            "steamId64 must be a 17-digit number".to_owned(),
        ));
    }
    Ok(value.to_owned())
}
