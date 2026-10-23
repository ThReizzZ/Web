use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::get,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{errors::AppError, state::AppState};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub topic_count: i64,
    pub post_count: i64,
    pub last_activity_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub name: String,
    pub role: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TopicRow {
    pub slug: String,
    pub title: String,
    pub excerpt: String,
    pub category_slug: String,
    pub category_name: String,
    pub category_icon: String,
    pub author_name: String,
    pub author_role: String,
    pub author_avatar_url: Option<String>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub views: i64,
    pub pinned: bool,
    pub hot: bool,
    pub reply_count: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TopicSummary {
    pub slug: String,
    pub title: String,
    pub excerpt: String,
    pub category_slug: String,
    pub category_name: String,
    pub category_icon: String,
    pub author: Author,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub views: i64,
    pub pinned: bool,
    pub hot: bool,
    pub reply_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicDetail {
    #[serde(flatten)]
    pub topic: TopicSummary,
    pub content: String,
    pub replies: Vec<Reply>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReplyRow {
    pub id: uuid::Uuid,
    pub content: String,
    pub likes: i32,
    pub created_at: DateTime<Utc>,
    pub author_name: String,
    pub author_role: String,
    pub author_avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reply {
    pub id: uuid::Uuid,
    pub content: String,
    pub likes: i32,
    pub created_at: DateTime<Utc>,
    pub author: Author,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ActiveUserRow {
    pub name: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub last_active_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveUser {
    pub name: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub last_active_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct TopicQuery {
    pub limit: Option<i64>,
    pub category: Option<String>,
    pub q: Option<String>,
    pub author: Option<uuid::Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ActiveUserQuery {
    pub limit: Option<i64>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/forum/categories", get(list_categories))
        .route("/forum/topics", get(list_topics))
        .route("/forum/topics/{slug}", get(get_topic))
        .route("/forum/active-users", get(list_active_users))
}

#[utoipa::path(get, path = "/api/v1/forum/categories", tag = "forum", responses((status = 200, description = "Forum categories with counts")))]
async fn list_categories(State(state): State<AppState>) -> Result<Json<Vec<Category>>, AppError> {
    let categories = sqlx::query_as::<_, Category>(
        r"
        SELECT c.slug, c.name, c.description, c.icon,
               (SELECT count(*) FROM topics t
                WHERE t.category_slug = c.slug AND t.deleted_at IS NULL)::bigint AS topic_count,
               (SELECT count(*) FROM replies r
                JOIN topics t ON t.id = r.topic_id
                WHERE t.category_slug = c.slug AND t.deleted_at IS NULL AND r.deleted_at IS NULL)::bigint AS post_count,
               (SELECT max(t.last_activity_at) FROM topics t
                WHERE t.category_slug = c.slug AND t.deleted_at IS NULL) AS last_activity_at
        FROM categories c
        ORDER BY c.sort_order, c.slug
        ",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(categories))
}

#[utoipa::path(get, path = "/api/v1/forum/topics", tag = "forum", responses((status = 200, description = "Topic list, optionally filtered by category, search query or author")))]
async fn list_topics(
    State(state): State<AppState>,
    Query(query): Query<TopicQuery>,
) -> Result<Json<Vec<TopicSummary>>, AppError> {
    let topics = fetch_topics(&state, query).await?;
    Ok(Json(topics))
}

#[utoipa::path(get, path = "/api/v1/forum/topics/{slug}", tag = "forum", params(("slug" = String, Path, description = "Topic slug")), responses((status = 200, description = "Topic detail and replies"), (status = 404, description = "Topic not found")))]
async fn get_topic(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<TopicDetail>, AppError> {
    let row = sqlx::query_as::<_, TopicDetailRow>(
        r"
        SELECT t.slug, t.title, t.excerpt, c.slug AS category_slug, c.name AS category_name,
               c.icon AS category_icon,
               u.persona_name AS author_name, u.role AS author_role, u.avatar_url AS author_avatar_url,
               t.tags, t.created_at, t.last_activity_at, t.views, t.pinned, t.hot,
               (SELECT count(*) FROM replies r WHERE r.topic_id = t.id AND r.deleted_at IS NULL)::bigint AS reply_count,
               t.content
        FROM topics t
        JOIN categories c ON c.slug = t.category_slug
        JOIN users u ON u.id = t.author_id
        WHERE t.slug = $1 AND t.deleted_at IS NULL
        ",
    )
    .bind(&slug)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let replies = sqlx::query_as::<_, ReplyRow>(
        r"
        SELECT r.id, r.content, r.likes, r.created_at,
               u.persona_name AS author_name, u.role AS author_role, u.avatar_url AS author_avatar_url
        FROM replies r
        JOIN users u ON u.id = r.author_id
        WHERE r.topic_id = (SELECT id FROM topics WHERE slug = $1 AND deleted_at IS NULL)
          AND r.deleted_at IS NULL
        ORDER BY r.created_at
        ",
    )
    .bind(&slug)
    .fetch_all(&state.db)
    .await?;

    let content = row.content.clone();
    let topic = row.into_summary();
    Ok(Json(TopicDetail {
        topic,
        content,
        replies: replies
            .into_iter()
            .map(|reply| Reply {
                id: reply.id,
                content: reply.content,
                likes: reply.likes,
                created_at: reply.created_at,
                author: Author {
                    name: reply.author_name,
                    role: reply.author_role,
                    avatar_url: reply.author_avatar_url,
                },
            })
            .collect(),
    }))
}

#[derive(Debug, FromRow)]
struct TopicDetailRow {
    slug: String,
    title: String,
    excerpt: String,
    category_slug: String,
    category_name: String,
    category_icon: String,
    author_name: String,
    author_role: String,
    author_avatar_url: Option<String>,
    tags: Vec<String>,
    created_at: DateTime<Utc>,
    last_activity_at: DateTime<Utc>,
    views: i64,
    pinned: bool,
    hot: bool,
    reply_count: i64,
    content: String,
}

impl TopicDetailRow {
    fn into_summary(self) -> TopicSummary {
        TopicSummary {
            slug: self.slug,
            title: self.title,
            excerpt: self.excerpt,
            category_slug: self.category_slug,
            category_name: self.category_name,
            category_icon: self.category_icon,
            author: Author {
                name: self.author_name,
                role: self.author_role,
                avatar_url: self.author_avatar_url,
            },
            tags: self.tags,
            created_at: self.created_at,
            last_activity_at: self.last_activity_at,
            views: self.views,
            pinned: self.pinned,
            hot: self.hot,
            reply_count: self.reply_count,
        }
    }
}

pub(crate) async fn fetch_topics(
    state: &AppState,
    query: TopicQuery,
) -> Result<Vec<TopicSummary>, AppError> {
    let limit = query.limit.unwrap_or(20).clamp(1, 50);
    let category = query
        .category
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if category
        .as_ref()
        .is_some_and(|value| value.chars().count() > 64)
    {
        return Err(AppError::Validation(
            "category must be at most 64 characters".to_owned(),
        ));
    }
    let search = query
        .q
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if search
        .as_ref()
        .is_some_and(|value| value.chars().count() > 120)
    {
        return Err(AppError::Validation(
            "q must be at most 120 characters".to_owned(),
        ));
    }
    let search = search.map(|value| format!("%{value}%"));
    let author = query.author;

    let rows = sqlx::query_as::<_, TopicRow>(
        r"
        SELECT t.slug, t.title, t.excerpt, c.slug AS category_slug, c.name AS category_name,
               c.icon AS category_icon,
               u.persona_name AS author_name, u.role AS author_role, u.avatar_url AS author_avatar_url,
               t.tags, t.created_at, t.last_activity_at, t.views, t.pinned, t.hot,
               (SELECT count(*) FROM replies r WHERE r.topic_id = t.id AND r.deleted_at IS NULL)::bigint AS reply_count
        FROM topics t
        JOIN categories c ON c.slug = t.category_slug
        JOIN users u ON u.id = t.author_id
        WHERE t.deleted_at IS NULL
          AND ($1::text IS NULL OR t.category_slug = $1)
          AND ($2::text IS NULL OR concat_ws(' ', t.title, t.excerpt, array_to_string(t.tags, ' '), u.persona_name, c.name) ILIKE $2)
          AND ($3::uuid IS NULL OR t.author_id = $3)
        ORDER BY t.pinned DESC, t.last_activity_at DESC
        LIMIT $4
        ",
    )
    .bind(category)
    .bind(search)
    .bind(author)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| TopicSummary {
            slug: row.slug,
            title: row.title,
            excerpt: row.excerpt,
            category_slug: row.category_slug,
            category_name: row.category_name,
            category_icon: row.category_icon,
            author: Author {
                name: row.author_name,
                role: row.author_role,
                avatar_url: row.author_avatar_url,
            },
            tags: row.tags,
            created_at: row.created_at,
            last_activity_at: row.last_activity_at,
            views: row.views,
            pinned: row.pinned,
            hot: row.hot,
            reply_count: row.reply_count,
        })
        .collect())
}

#[utoipa::path(get, path = "/api/v1/forum/active-users", tag = "forum", responses((status = 200, description = "Recently active forum authors")))]
async fn list_active_users(
    State(state): State<AppState>,
    Query(query): Query<ActiveUserQuery>,
) -> Result<Json<Vec<ActiveUser>>, AppError> {
    let limit = query.limit.unwrap_or(8).clamp(1, 30);
    let rows = sqlx::query_as::<_, ActiveUserRow>(
        r"
        SELECT u.persona_name AS name, u.role, u.avatar_url, max(activity.created_at) AS last_active_at
        FROM users u
        JOIN (
            SELECT author_id, created_at FROM topics WHERE deleted_at IS NULL
            UNION ALL
            SELECT author_id, created_at FROM replies WHERE deleted_at IS NULL
        ) activity ON activity.author_id = u.id
        WHERE u.is_system = false
        GROUP BY u.id, u.persona_name, u.role, u.avatar_url
        ORDER BY last_active_at DESC
        LIMIT $1
        ",
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|row| ActiveUser {
                name: row.name,
                role: row.role,
                avatar_url: row.avatar_url,
                last_active_at: row.last_active_at,
            })
            .collect(),
    ))
}
