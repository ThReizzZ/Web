use std::{collections::HashMap, time::Duration};

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{HeaderMap, Request, StatusCode, header},
    response::Response,
};
use serde_json::{Value, json};
use sqlx::postgres::PgPoolOptions;
use threi_api::{app::build_router, config::Settings, state::AppState};
use tower::ServiceExt;

fn test_settings(docs_enabled: bool, cors_origins: &str) -> Settings {
    let values = HashMap::from([
        ("APP_ENV", "test"),
        (
            "DATABASE_URL",
            "postgres://threi:secret@127.0.0.1:1/threi_test",
        ),
        ("DATABASE_MAX_CONNECTIONS", "1"),
        ("DATABASE_MIN_CONNECTIONS", "0"),
        ("DATABASE_ACQUIRE_TIMEOUT_SECS", "1"),
        ("DATABASE_CONNECT_TIMEOUT_SECS", "1"),
        (
            "API_DOCS_ENABLED",
            if docs_enabled { "true" } else { "false" },
        ),
        ("CORS_ALLOWED_ORIGINS", cors_origins),
        ("REDIS_REQUIRED", "false"),
    ]);

    Settings::from_lookup(|key| values.get(key).map(|value| (*value).to_owned()))
        .expect("test settings should be valid")
}

fn test_state() -> AppState {
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_millis(100))
        .connect_lazy("postgres://threi:secret@127.0.0.1:1/threi_test")
        .expect("lazy test pool should be constructed");

    AppState::new(pool, None, false, "test")
}

fn test_router(settings: &Settings) -> Router {
    build_router(test_state(), settings)
}

async fn send(router: Router, request: Request<Body>) -> (StatusCode, HeaderMap, Value) {
    let response: Response = router.oneshot(request).await.expect("request should run");
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = to_bytes(response.into_body(), 1024 * 1024)
        .await
        .expect("body should be readable");
    let body = if bytes.is_empty() {
        json!(null)
    } else {
        serde_json::from_slice(&bytes).expect("response should be JSON")
    };

    (status, headers, body)
}

#[tokio::test]
async fn liveness_is_public_and_carries_request_id() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/health/live")
        .body(Body::empty())
        .expect("request should build");

    let (status, headers, body) = send(router, request).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "threi-api");
    assert!(headers.contains_key("x-request-id"));
    assert_eq!(headers["x-content-type-options"], "nosniff");
}

#[tokio::test]
async fn valid_upstream_request_id_is_preserved() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/health/live")
        .header("x-request-id", "req_test-123")
        .body(Body::empty())
        .expect("request should build");

    let (_, headers, _) = send(router, request).await;

    assert_eq!(headers["x-request-id"], "req_test-123");
}

#[tokio::test]
async fn invalid_upstream_request_id_is_replaced() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/health/live")
        .header("x-request-id", "invalid id with spaces")
        .body(Body::empty())
        .expect("request should build");

    let (_, headers, _) = send(router, request).await;

    assert_ne!(headers["x-request-id"], "invalid id with spaces");
}

#[tokio::test]
async fn unknown_route_uses_error_envelope() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/not-a-route")
        .body(Body::empty())
        .expect("request should build");

    let (status, headers, body) = send(router, request).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");
    assert_eq!(
        body["error"]["message"],
        "The requested resource was not found."
    );
    assert_eq!(headers[header::CACHE_CONTROL], "no-store");
    assert!(headers.contains_key("x-request-id"));
}

#[tokio::test]
async fn wrong_method_uses_error_envelope() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .method("POST")
        .uri("/health/live")
        .body(Body::empty())
        .expect("request should build");

    let (status, _, body) = send(router, request).await;

    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(body["error"]["code"], "method_not_allowed");
}

#[tokio::test]
async fn system_info_is_non_sensitive() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/api/v1/system/info")
        .body(Body::empty())
        .expect("request should build");

    let (status, _, body) = send(router, request).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["name"], "threi-api");
    assert_eq!(body["api_version"], "v1");
    assert_eq!(body["environment"], "test");
    assert!(body.get("database_url").is_none());
    assert!(!body.to_string().contains("postgres://"));
}

#[tokio::test]
async fn readiness_fails_without_database_and_leaks_no_credentials() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/health/ready")
        .body(Body::empty())
        .expect("request should build");

    let (status, _, body) = send(router, request).await;

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["status"], "unavailable");
    assert_eq!(body["checks"]["database"], "unavailable");
    assert_eq!(body["checks"]["redis"], "disabled");
    assert!(!body.to_string().contains("postgres://"));
    assert!(!body.to_string().contains("secret"));
}

#[tokio::test]
async fn openapi_and_swagger_can_be_disabled() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/api/v1/openapi.json")
        .body(Body::empty())
        .expect("request should build");

    let (status, _, body) = send(router, request).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");
}

#[tokio::test]
async fn openapi_contract_is_served_when_enabled() {
    let router = test_router(&test_settings(true, ""));
    let request = Request::builder()
        .uri("/api/v1/openapi.json")
        .body(Body::empty())
        .expect("request should build");

    let (status, _, body) = send(router, request).await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["paths"]["/health/live"].is_object());
    assert!(body["paths"]["/health/ready"].is_object());
    assert!(body["paths"]["/api/v1/system/info"].is_object());
    assert!(body["components"]["schemas"]["ReadinessResponse"].is_object());
}

#[tokio::test]
async fn cors_allows_configured_origin_only() {
    let router = test_router(&test_settings(true, "http://localhost:3000"));

    let allowed = Request::builder()
        .method("OPTIONS")
        .uri("/api/v1/system/info")
        .header("origin", "http://localhost:3000")
        .header("access-control-request-method", "GET")
        .body(Body::empty())
        .expect("request should build");
    let (status, headers, _) = send(router, allowed).await;
    assert!(status.is_success());
    assert_eq!(
        headers[header::ACCESS_CONTROL_ALLOW_ORIGIN],
        "http://localhost:3000"
    );

    let router = test_router(&test_settings(true, "http://localhost:3000"));
    let denied = Request::builder()
        .method("OPTIONS")
        .uri("/api/v1/system/info")
        .header("origin", "https://evil.example")
        .header("access-control-request-method", "GET")
        .body(Body::empty())
        .expect("request should build");
    let (_, headers, _) = send(router, denied).await;
    assert!(!headers.contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN));
}

#[tokio::test]
async fn steam_login_redirects_to_steam_openid() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/api/v1/auth/steam/login")
        .body(Body::empty())
        .expect("request should build");

    let (status, headers, _) = send(router, request).await;

    assert_eq!(status, StatusCode::TEMPORARY_REDIRECT);
    let location = headers[header::LOCATION]
        .to_str()
        .expect("location should be a string");
    assert!(location.starts_with("https://steamcommunity.com/openid/login?"));
    assert!(location.contains("openid.mode=checkid_setup"));
}

#[tokio::test]
async fn me_returns_null_without_a_session() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/api/v1/auth/me")
        .body(Body::empty())
        .expect("request should build");

    let (status, _, body) = send(router, request).await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["user"].is_null());
}

#[tokio::test]
async fn account_requires_authentication() {
    let router = test_router(&test_settings(false, ""));
    let request = Request::builder()
        .uri("/api/v1/account")
        .body(Body::empty())
        .expect("request should build");

    let (status, headers, body) = send(router, request).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthorized");
    assert_eq!(headers[header::CACHE_CONTROL], "no-store");
}

#[tokio::test]
async fn admin_endpoints_require_authentication() {
    for path in [
        "/api/v1/admin/admins",
        "/api/v1/admin/users/lookup?steamId64=76561198000000000",
        "/api/v1/admin/forum/topics",
        "/api/v1/admin/servers",
        "/api/v1/admin/server-communities",
        "/api/v1/admin/server-bans",
        "/api/v1/admin/server-ip-bans",
        "/api/v1/admin/whitelist",
    ] {
        let router = test_router(&test_settings(false, ""));
        let request = Request::builder()
            .uri(path)
            .body(Body::empty())
            .expect("request should build");
        let (status, _, body) = send(router, request).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "path {path}");
        assert_eq!(body["error"]["code"], "unauthorized", "path {path}");
    }
}
