use std::time::Duration;

use axum::{
    Router,
    extract::Request,
    http::{
        HeaderName, HeaderValue, Method,
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    limit::RequestBodyLimitLayer,
    set_header::SetResponseHeaderLayer,
    trace::{DefaultOnFailure, DefaultOnResponse, TraceLayer},
};
use tracing::Level;

use crate::{
    config::Settings,
    errors::AppError,
    middleware::request_id::{make_span, propagate_request_id},
    openapi, routes,
    state::AppState,
};

/// Builds the complete HTTP application.
///
/// Layer order (outermost first): request id, security headers, tracing,
/// CORS, request timeout, body limit, routes. Keeping request id outside the
/// trace span lets every log line and error response carry the same id.
pub fn build_router(state: AppState, settings: &Settings) -> Router {
    let request_timeout = settings.http.request_timeout;

    let mut router = Router::new()
        .route("/health/live", get(routes::health::live))
        .route("/health/ready", get(routes::health::ready))
        .nest("/api/v1", routes::api_v1())
        .fallback(routes::fallback::not_found)
        .method_not_allowed_fallback(routes::fallback::method_not_allowed)
        .with_state(state)
        .layer(axum::Extension(settings.auth.clone()));

    if settings.http.docs_enabled {
        router = router.merge(openapi::docs_router());
    }

    router
        .layer(RequestBodyLimitLayer::new(settings.http.body_limit_bytes))
        .layer(middleware::from_fn(move |request: Request, next: Next| {
            let timeout = request_timeout;
            async move { timeout_request(request, next, timeout).await }
        }))
        .layer(cors_layer(&settings.http.cors_allowed_origins))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(make_span)
                .on_response(DefaultOnResponse::new().level(Level::INFO))
                .on_failure(DefaultOnFailure::new().level(Level::ERROR)),
        )
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("no-referrer"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
        ))
        .layer(middleware::from_fn(propagate_request_id))
}

async fn timeout_request(request: Request, next: Next, timeout: Duration) -> Response {
    // Server-Sent Events are long-lived by design and must not be cut off by
    // the normal request timeout. The endpoint only emits server IDs.
    if request.uri().path() == "/api/v1/servers/stream" {
        return next.run(request).await;
    }

    match tokio::time::timeout(timeout, next.run(request)).await {
        Ok(response) => response,
        Err(_) => AppError::RequestTimeout.into_response(),
    }
}

fn cors_layer(origins: &[String]) -> CorsLayer {
    let mut layer = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::HEAD,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            ACCEPT,
            AUTHORIZATION,
            CONTENT_TYPE,
            HeaderName::from_static("x-request-id"),
            HeaderName::from_static("x-csrf-token"),
        ])
        .expose_headers([HeaderName::from_static("x-request-id")])
        .allow_credentials(true)
        .max_age(Duration::from_mins(10));

    if !origins.is_empty() {
        let allowed = origins
            .iter()
            .filter_map(|origin| HeaderValue::from_str(origin).ok())
            .collect::<Vec<_>>();
        layer = layer.allow_origin(AllowOrigin::list(allowed));
    }

    layer
}
