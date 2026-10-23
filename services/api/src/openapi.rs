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
        title = "threi API",
        version = env!("CARGO_PKG_VERSION"),
        description = "threi community API. Business endpoints are versioned under /api/v1. Health endpoints are infrastructure-only and are not routed through the public Nginx entry point."
    ),
    paths(
        crate::routes::health::live,
        crate::routes::health::ready,
        crate::routes::system::info
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
        (name = "system", description = "Public service metadata")
    )
)]
pub struct ApiDoc;

/// `OpenAPI` JSON plus Swagger UI. Mounted only when `API_DOCS_ENABLED=true`.
pub fn docs_router() -> Router {
    Router::new()
        .merge(SwaggerUi::new("/api/v1/docs").url("/api/v1/openapi.json", ApiDoc::openapi()))
}
