use std::collections::HashSet;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    errors::AppError,
    modules::auth::{AuthUser, require_user},
    state::AppState,
};

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

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTopicRequest {
    pub category_slug: String,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateReplyRequest {
    pub content: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/forum/categories", get(list_categories))
        .route("/forum/topics", get(list_topics).post(create_topic))
        .route("/forum/topics/{slug}", get(get_topic))
        .route("/forum/topics/{slug}/replies", post(create_reply))
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

#[utoipa::path(
    post,
    path = "/api/v1/forum/topics",
    tag = "forum",
    responses(
        (status = 201, description = "Topic created"),
        (status = 401, description = "Authentication required"),
        (status = 400, description = "Invalid topic data or missing permission")
    )
)]
async fn create_topic(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateTopicRequest>,
) -> Result<(StatusCode, Json<TopicSummary>), AppError> {
    let user = require_user(&state, &headers).await?;
    ensure_not_muted(&state, &user).await?;

    let category_slug = request.category_slug.trim();
    if category_slug.is_empty() || category_slug.chars().count() > 64 {
        return Err(AppError::bad_request("分类标识无效。"));
    }
    let category = sqlx::query_scalar::<_, String>("SELECT slug FROM categories WHERE slug = $1")
        .bind(category_slug)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::bad_request("分类不存在。"))?;

    if category == "announcements" && user.role != "admin" {
        return Err(AppError::bad_request("只有管理员可以在公告分类发布主题。"));
    }

    let title = request.title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(AppError::bad_request(
            "标题长度需要在 1 到 200 个字符之间。",
        ));
    }
    let content = request.content.trim();
    if content.is_empty() || content.chars().count() > 100_000 {
        return Err(AppError::bad_request(
            "正文长度需要在 1 到 100000 个字符之间。",
        ));
    }

    let tags = normalize_tags(request.tags)?;
    let excerpt = build_excerpt(content);
    let slug = unique_topic_slug(&state, title).await?;

    let row = sqlx::query_as::<_, TopicRow>(
        r"
        WITH inserted AS (
            INSERT INTO topics (slug, category_slug, author_id, title, excerpt, content, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        )
        SELECT t.slug, t.title, t.excerpt, c.slug AS category_slug, c.name AS category_name,
               c.icon AS category_icon,
               u.persona_name AS author_name, u.role AS author_role,
               u.avatar_url AS author_avatar_url,
               t.tags, t.created_at, t.last_activity_at, t.views, t.pinned, t.hot,
               0::bigint AS reply_count
        FROM inserted t
        JOIN categories c ON c.slug = t.category_slug
        JOIN users u ON u.id = t.author_id
        ",
    )
    .bind(&slug)
    .bind(&category)
    .bind(user.id)
    .bind(title)
    .bind(&excerpt)
    .bind(content)
    .bind(&tags)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(row.into_summary())))
}

#[utoipa::path(
    post,
    path = "/api/v1/forum/topics/{slug}/replies",
    tag = "forum",
    params(("slug" = String, Path, description = "Topic slug")),
    responses(
        (status = 201, description = "Reply created"),
        (status = 401, description = "Authentication required"),
        (status = 404, description = "Topic not found"),
        (status = 400, description = "Invalid reply data or muted user")
    )
)]
async fn create_reply(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    Json(request): Json<CreateReplyRequest>,
) -> Result<(StatusCode, Json<Reply>), AppError> {
    let user = require_user(&state, &headers).await?;
    ensure_not_muted(&state, &user).await?;

    let content = request.content.trim();
    if content.is_empty() || content.chars().count() > 20_000 {
        return Err(AppError::bad_request(
            "回复长度需要在 1 到 20000 个字符之间。",
        ));
    }

    let mut transaction = state.db.begin().await?;
    let topic_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM topics WHERE slug = $1 AND deleted_at IS NULL",
    )
    .bind(&slug)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or(AppError::NotFound)?;

    let (id, created_at) = sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
        "INSERT INTO replies (topic_id, author_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, created_at",
    )
    .bind(topic_id)
    .bind(user.id)
    .bind(content)
    .fetch_one(&mut *transaction)
    .await?;

    sqlx::query("UPDATE topics SET last_activity_at = now() WHERE id = $1")
        .bind(topic_id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;

    Ok((
        StatusCode::CREATED,
        Json(Reply {
            id,
            content: content.to_owned(),
            likes: 0,
            created_at,
            author: Author {
                name: user.persona_name,
                role: user.role,
                avatar_url: user.avatar_url,
            },
        }),
    ))
}

async fn ensure_not_muted(state: &AppState, user: &AuthUser) -> Result<(), AppError> {
    let mute = sqlx::query_as::<_, (String, Option<DateTime<Utc>>)>(
        r"
        SELECT reason, expires_at
        FROM forum_mutes
        WHERE steam_id64 = $1
          AND lifted_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
        LIMIT 1
        ",
    )
    .bind(&user.steam_id64)
    .fetch_optional(&state.db)
    .await?;

    if let Some((reason, expires_at)) = mute {
        let message = match expires_at {
            Some(expires_at) => format!(
                "您已被论坛禁言：{reason}（解除时间：{}）",
                expires_at.format("%Y-%m-%d %H:%M UTC")
            ),
            None => format!("您已被论坛禁言：{reason}"),
        };
        return Err(AppError::bad_request(message));
    }

    Ok(())
}

fn build_excerpt(content: &str) -> String {
    let compact = content.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut excerpt = compact.chars().take(180).collect::<String>();
    if compact.chars().count() > 180 {
        excerpt.push('…');
    }
    excerpt
}

fn normalize_tags(tags: Vec<String>) -> Result<Vec<String>, AppError> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for tag in tags {
        let tag = tag.trim().trim_start_matches('#').trim();
        if tag.is_empty() {
            continue;
        }
        if tag.chars().count() > 24 {
            return Err(AppError::bad_request("单个标签不能超过 24 个字符。"));
        }
        if seen.insert(tag.to_lowercase()) {
            normalized.push(tag.to_owned());
        }
    }

    if normalized.len() > 5 {
        return Err(AppError::bad_request("最多只能添加 5 个标签。"));
    }

    Ok(normalized)
}

async fn unique_topic_slug(state: &AppState, title: &str) -> Result<String, AppError> {
    let mut base = String::new();
    let mut pending_separator = false;
    for character in title.chars() {
        if character.is_ascii_alphanumeric() {
            if pending_separator && !base.is_empty() {
                base.push('-');
            }
            pending_separator = false;
            base.push(character.to_ascii_lowercase());
        } else {
            pending_separator = true;
        }
    }
    if base.is_empty() {
        base.push_str("topic");
    }
    let base = base.chars().take(48).collect::<String>();

    for _ in 0..5 {
        let suffix = Uuid::new_v4().simple().to_string();
        let slug = format!("{base}-{}", &suffix[..8]);
        let exists =
            sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM topics WHERE slug = $1)")
                .bind(&slug)
                .fetch_one(&state.db)
                .await?;
        if !exists {
            return Ok(slug);
        }
    }

    Err(AppError::Conflict)
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

impl TopicRow {
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

    Ok(rows.into_iter().map(TopicRow::into_summary).collect())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn excerpt_collapses_whitespace_and_truncates() {
        assert_eq!(
            build_excerpt("第一行\n\n第二行  第三行"),
            "第一行 第二行 第三行"
        );

        let long = "字".repeat(200);
        let excerpt = build_excerpt(&long);
        assert_eq!(excerpt.chars().count(), 181);
        assert!(excerpt.ends_with('…'));
    }

    #[test]
    fn tags_are_trimmed_deduplicated_and_limited() {
        let tags = normalize_tags(vec![
            " 地图 ".to_owned(),
            "#地图".to_owned(),
            "连跳".to_owned(),
            "   ".to_owned(),
        ])
        .expect("tags should be valid");
        assert_eq!(tags, vec!["地图", "连跳"]);

        let too_many = normalize_tags(
            (0..6)
                .map(|index| format!("tag-{index}"))
                .collect::<Vec<_>>(),
        );
        assert!(too_many.is_err());
    }
}
