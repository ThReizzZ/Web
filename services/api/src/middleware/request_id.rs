use axum::{
    extract::{FromRequestParts, Request},
    http::{HeaderValue, header::HeaderName, request::Parts},
    middleware::Next,
    response::Response,
};
use std::convert::Infallible;
use tracing::Span;
use uuid::Uuid;

pub const REQUEST_ID_HEADER: HeaderName = HeaderName::from_static("x-request-id");

/// Request identifier stored in request extensions and returned to clients.
#[derive(Clone, Debug)]
pub struct RequestId(String);

impl RequestId {
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S> FromRequestParts<S> for RequestId
where
    S: Send + Sync,
{
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        Ok(parts
            .extensions
            .get::<Self>()
            .cloned()
            .unwrap_or_else(|| Self(Uuid::new_v4().to_string())))
    }
}

/// Accepts an upstream request id (for example Nginx `$request_id`) only when
/// it is short and restricted to safe characters; otherwise generates one.
pub async fn propagate_request_id(mut request: Request, next: Next) -> Response {
    let incoming = request
        .headers()
        .get(&REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .filter(|value| is_valid_request_id(value))
        .map(str::to_owned);

    let request_id = incoming.unwrap_or_else(|| Uuid::new_v4().to_string());
    request
        .extensions_mut()
        .insert(RequestId(request_id.clone()));

    let mut response = next.run(request).await;
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert(REQUEST_ID_HEADER, value);
    }
    response
}

/// Creates the tracing span for an HTTP request. The request id is populated
/// by `propagate_request_id`, which runs outside the trace layer.
pub fn make_span<B>(request: &Request<B>) -> Span {
    let request_id = request
        .extensions()
        .get::<RequestId>()
        .map_or("-", RequestId::as_str);

    tracing::info_span!(
        "http_request",
        method = %request.method(),
        path = request.uri().path(),
        request_id = request_id
    )
}

fn is_valid_request_id(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}
