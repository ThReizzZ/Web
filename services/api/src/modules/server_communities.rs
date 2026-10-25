//! Admin-managed community groups.
//!
//! A community group is a first-class label that organizes server instances in
//! the catalog. Admins create a group first and then attach any number of
//! servers to it; a server belongs to at most one group. Deleting a group only
//! detaches its servers, it never deletes the servers themselves.

use std::collections::{HashMap, HashSet};

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, patch, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::AppError,
    modules::{auth::require_admin, server_plugin::STALE_AFTER_SECS},
    state::AppState,
};

const MAX_NAME_CHARS: usize = 60;
const MAX_DESCRIPTION_CHARS: usize = 200;
const MAX_SERVERS_PER_REQUEST: usize = 200;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CommunityOverview {
    pub communities: Vec<AdminCommunity>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdminCommunity {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub servers: Vec<CommunityServer>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CommunityServer {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub status: String,
    pub is_active: bool,
    pub player_count: Option<i32>,
    pub max_players: i32,
    pub plugin_state: String,
}

#[derive(Debug, FromRow)]
struct CommunityRow {
    id: String,
    name: String,
    description: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct CommunityServerRow {
    community_id: String,
    id: String,
    name: String,
    host: String,
    port: i32,
    status: String,
    is_active: bool,
    player_count: Option<i32>,
    max_players: i32,
    plugin_state: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommunityRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommunityResponse {
    pub id: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCommunityRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddCommunityServersRequest {
    #[serde(default)]
    pub server_ids: Vec<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/admin/server-communities",
            get(overview).post(create_community),
        )
        .route(
            "/admin/server-communities/{id}",
            patch(update_community).delete(delete_community),
        )
        .route("/admin/server-communities/{id}/servers", post(add_servers))
        .route(
            "/admin/server-communities/{id}/servers/{server_id}",
            delete(remove_server),
        )
}

#[utoipa::path(
    get,
    path = "/api/v1/admin/server-communities",
    tag = "admin",
    responses(
        (status = 200, description = "Community groups with their server instances", body = CommunityOverview),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse)
    )
)]
async fn overview(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<CommunityOverview>, AppError> {
    require_admin(&state, &headers).await?;

    let communities = sqlx::query_as::<_, CommunityRow>(
        r"
        SELECT id, name, description, created_at, updated_at
        FROM server_communities
        ORDER BY lower(name), name
        ",
    )
    .fetch_all(&state.db)
    .await?;

    let servers = sqlx::query_as::<_, CommunityServerRow>(
        r"
        SELECT community_id, id, name, host, port, status, is_active,
               player_count, max_players,
               CASE
                   WHEN plugin_token IS NULL THEN 'disabled'
                   WHEN last_reported_at IS NOT NULL
                        AND last_reported_at > now() - make_interval(secs => $1::double precision)
                       THEN 'connected'
                   ELSE 'waiting'
               END AS plugin_state
        FROM servers
        WHERE community_id IS NOT NULL
        ORDER BY name
        ",
    )
    .bind(f64::from(STALE_AFTER_SECS))
    .fetch_all(&state.db)
    .await?;

    let mut grouped: HashMap<String, Vec<CommunityServer>> = HashMap::new();
    for row in servers {
        grouped
            .entry(row.community_id)
            .or_default()
            .push(CommunityServer {
                id: row.id,
                name: row.name,
                host: row.host,
                port: row.port,
                status: row.status,
                is_active: row.is_active,
                player_count: row.player_count,
                max_players: row.max_players,
                plugin_state: row.plugin_state,
            });
    }

    let communities = communities
        .into_iter()
        .map(|row| AdminCommunity {
            id: row.id.clone(),
            name: row.name,
            description: row.description,
            created_at: row.created_at,
            updated_at: row.updated_at,
            servers: grouped.remove(&row.id).unwrap_or_default(),
        })
        .collect();

    Ok(Json(CommunityOverview { communities }))
}

#[utoipa::path(
    post,
    path = "/api/v1/admin/server-communities",
    tag = "admin",
    request_body = CreateCommunityRequest,
    responses(
        (status = 201, description = "Community group created", body = CreateCommunityResponse),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 409, description = "A group with the same name already exists", body = crate::errors::ErrorResponse),
        (status = 422, description = "Invalid name or description", body = crate::errors::ErrorResponse)
    )
)]
async fn create_community(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateCommunityRequest>,
) -> Result<(StatusCode, Json<CreateCommunityResponse>), AppError> {
    require_admin(&state, &headers).await?;
    let name = validate_name(&request.name)?;
    let description = validate_description(&request.description)?;
    if name_exists(&state, &name, None).await? {
        return Err(AppError::Conflict);
    }

    let id = format!("com-{}", &Uuid::new_v4().simple().to_string()[..12]);
    sqlx::query("INSERT INTO server_communities (id, name, description) VALUES ($1, $2, $3)")
        .bind(&id)
        .bind(&name)
        .bind(&description)
        .execute(&state.db)
        .await?;

    Ok((StatusCode::CREATED, Json(CreateCommunityResponse { id })))
}

#[utoipa::path(
    patch,
    path = "/api/v1/admin/server-communities/{id}",
    tag = "admin",
    params(("id" = String, Path, description = "Community group id")),
    request_body = UpdateCommunityRequest,
    responses(
        (status = 204, description = "Community group updated"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Community group not found", body = crate::errors::ErrorResponse),
        (status = 409, description = "A group with the same name already exists", body = crate::errors::ErrorResponse),
        (status = 422, description = "Invalid name or description", body = crate::errors::ErrorResponse)
    )
)]
async fn update_community(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(request): Json<UpdateCommunityRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    if request.name.is_none() && request.description.is_none() {
        return Err(AppError::Validation(
            "at least one of name or description is required".to_owned(),
        ));
    }
    let name = match request.name.as_deref() {
        Some(value) => Some(validate_name(value)?),
        None => None,
    };
    let description = match request.description.as_deref() {
        Some(value) => Some(validate_description(value)?),
        None => None,
    };
    if let Some(name) = name.as_deref()
        && name_exists(&state, name, Some(&id)).await?
    {
        return Err(AppError::Conflict);
    }

    let result = sqlx::query(
        r"
        UPDATE server_communities
        SET name = COALESCE($2::text, name),
            description = COALESCE($3::text, description)
        WHERE id = $1
        ",
    )
    .bind(&id)
    .bind(name.as_deref())
    .bind(description.as_deref())
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/api/v1/admin/server-communities/{id}",
    tag = "admin",
    params(("id" = String, Path, description = "Community group id")),
    responses(
        (status = 204, description = "Community group deleted; member servers become ungrouped"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Community group not found", body = crate::errors::ErrorResponse)
    )
)]
async fn delete_community(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result = sqlx::query("DELETE FROM server_communities WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/admin/server-communities/{id}/servers",
    tag = "admin",
    params(("id" = String, Path, description = "Community group id")),
    request_body = AddCommunityServersRequest,
    responses(
        (status = 204, description = "Servers attached to the group"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Community group not found", body = crate::errors::ErrorResponse),
        (status = 422, description = "Invalid or unknown server ids", body = crate::errors::ErrorResponse)
    )
)]
async fn add_servers(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(request): Json<AddCommunityServersRequest>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let ids = normalize_server_ids(request.server_ids)?;

    let mut transaction = state.db.begin().await?;
    let group_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM server_communities WHERE id = $1)",
    )
    .bind(&id)
    .fetch_one(&mut *transaction)
    .await?;
    if !group_exists {
        return Err(AppError::NotFound);
    }
    let found = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM servers WHERE id = ANY($1)")
        .bind(&ids)
        .fetch_one(&mut *transaction)
        .await?;
    if usize::try_from(found).ok() != Some(ids.len()) {
        return Err(AppError::Validation(
            "one or more server ids do not exist".to_owned(),
        ));
    }
    sqlx::query("UPDATE servers SET community_id = $1 WHERE id = ANY($2)")
        .bind(&id)
        .bind(&ids)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/api/v1/admin/server-communities/{id}/servers/{server_id}",
    tag = "admin",
    params(
        ("id" = String, Path, description = "Community group id"),
        ("server_id" = String, Path, description = "Server id")
    ),
    responses(
        (status = 204, description = "Server detached from the group"),
        (status = 401, description = "Authentication required", body = crate::errors::ErrorResponse),
        (status = 403, description = "Administrator role required", body = crate::errors::ErrorResponse),
        (status = 404, description = "Server is not in this community group", body = crate::errors::ErrorResponse)
    )
)]
async fn remove_server(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, server_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers).await?;
    let result =
        sqlx::query("UPDATE servers SET community_id = NULL WHERE id = $1 AND community_id = $2")
            .bind(&server_id)
            .bind(&id)
            .execute(&state.db)
            .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn name_exists(
    state: &AppState,
    name: &str,
    except_id: Option<&str>,
) -> Result<bool, AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS (
            SELECT 1
            FROM server_communities
            WHERE lower(name) = lower($1)
              AND ($2::text IS NULL OR id <> $2)
        )
        ",
    )
    .bind(name)
    .bind(except_id)
    .fetch_one(&state.db)
    .await?;
    Ok(exists)
}

fn validate_name(value: &str) -> Result<String, AppError> {
    let name = value.trim();
    if name.is_empty()
        || name.chars().count() > MAX_NAME_CHARS
        || name.chars().any(char::is_control)
    {
        return Err(AppError::Validation(format!(
            "name must be 1-{MAX_NAME_CHARS} characters and contain no control characters"
        )));
    }
    Ok(name.to_owned())
}

fn validate_description(value: &str) -> Result<String, AppError> {
    let description = value.trim();
    if description.chars().count() > MAX_DESCRIPTION_CHARS
        || description.chars().any(char::is_control)
    {
        return Err(AppError::Validation(format!(
            "description must be at most {MAX_DESCRIPTION_CHARS} characters and contain no control characters"
        )));
    }
    Ok(description.to_owned())
}

fn normalize_server_ids(values: Vec<String>) -> Result<Vec<String>, AppError> {
    let mut seen = HashSet::new();
    let ids = values
        .into_iter()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .filter(|value| seen.insert(value.clone()))
        .collect::<Vec<_>>();
    if ids.is_empty() {
        return Err(AppError::Validation(
            "serverIds must contain at least one server id".to_owned(),
        ));
    }
    if ids.len() > MAX_SERVERS_PER_REQUEST {
        return Err(AppError::Validation(format!(
            "serverIds must contain at most {MAX_SERVERS_PER_REQUEST} server ids"
        )));
    }
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn community_name_is_trimmed_and_limited() {
        assert_eq!(validate_name("  KZ 社区  ").unwrap(), "KZ 社区");
        assert!(validate_name("   ").is_err());
        assert!(validate_name(&"名".repeat(MAX_NAME_CHARS + 1)).is_err());
        assert!(validate_name("bad\nname").is_err());
    }

    #[test]
    fn community_description_is_trimmed_and_limited() {
        assert_eq!(
            validate_description("  主机上的实例  ").unwrap(),
            "主机上的实例"
        );
        assert_eq!(validate_description("   ").unwrap(), "");
        assert!(validate_description(&"字".repeat(MAX_DESCRIPTION_CHARS + 1)).is_err());
        assert!(validate_description("bad\ttext").is_err());
    }

    #[test]
    fn server_ids_are_trimmed_and_deduplicated() {
        let ids = normalize_server_ids(vec![
            " srv-1 ".to_owned(),
            "srv-1".to_owned(),
            String::new(),
            "srv-2".to_owned(),
        ])
        .unwrap();
        assert_eq!(ids, vec!["srv-1", "srv-2"]);
        assert!(normalize_server_ids(vec!["   ".to_owned()]).is_err());
    }
}
