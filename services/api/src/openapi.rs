use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    errors::{ErrorBody, ErrorResponse},
    routes::{
        health::{
            ComponentState, LivenessResponse, ReadinessChecks, ReadinessResponse, ReadinessStatus,
        },
        system::SystemInfo,
    },
};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "ThRei API",
        version = env!("CARGO_PKG_VERSION"),
        description = "ThRei community API. Business endpoints are versioned under /api/v1. Health endpoints are infrastructure-only and are not routed through the public Nginx entry point."
    ),
    paths(
        crate::routes::health::live,
        crate::routes::health::ready,
        crate::routes::system::info,
        crate::modules::auth::steam_login,
        crate::modules::auth::steam_callback,
        crate::modules::auth::me,
        crate::modules::auth::logout,
        crate::modules::servers::list_servers,
        crate::modules::forum::list_categories,
        crate::modules::forum::list_topics,
        crate::modules::forum::get_topic,
        crate::modules::forum::list_active_users,
        crate::modules::community::overview,
        crate::modules::account::account_overview,
        crate::modules::admin::overview
    ),
    components(schemas(
        LivenessResponse,
        ReadinessResponse,
        ReadinessChecks,
        ReadinessStatus,
        ComponentState,
        SystemInfo,
        ErrorResponse,
        ErrorBody
    )),
    tags(
        (name = "health", description = "Liveness and readiness probes"),
        (name = "system", description = "Public service metadata"),
        (name = "auth", description = "Steam OpenID login and cookie sessions"),
        (name = "servers", description = "KZ server directory and live players"),
        (name = "forum", description = "Forum categories, topics and replies"),
        (name = "community", description = "Community-wide statistics"),
        (name = "account", description = "Authenticated user account"),
        (name = "admin", description = "Admin-only operational data")
    )
)]
pub struct ApiDoc;

/// `OpenAPI` JSON plus Swagger UI. Mounted only when `API_DOCS_ENABLED=true`.
pub fn docs_router() -> Router {
    Router::new()
        .merge(SwaggerUi::new("/api/v1/docs").url("/api/v1/openapi.json", ApiDoc::openapi()))
}
