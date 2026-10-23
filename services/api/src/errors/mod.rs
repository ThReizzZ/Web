use std::error::Error;

use axum::{
    Json,
    http::{HeaderValue, StatusCode, header::CACHE_CONTROL},
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

/// Unified API error type.
///
/// Internal error sources are logged server-side and never serialized to
/// clients. The HTTP response always uses the same JSON envelope and carries
/// `x-request-id` via the request-id middleware.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("Authentication is required.")]
    Unauthorized,
    #[error("You do not have permission to perform this action.")]
    Forbidden,
    #[error("The requested resource was not found.")]
    NotFound,
    #[error("The requested method is not allowed for this resource.")]
    MethodNotAllowed,
    #[error("The request conflicts with the current state of the resource.")]
    Conflict,
    #[error("The request could not be validated.")]
    Validation(String),
    #[error("Too many requests. Please try again later.")]
    TooManyRequests,
    #[error("The request took too long to process.")]
    RequestTimeout,
    #[error("The service is temporarily unavailable.")]
    ServiceUnavailable,
    #[error("An internal error occurred.")]
    Internal(#[source] Box<dyn Error + Send + Sync>),
}

impl AppError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest(message.into())
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(message.into())
    }

    pub fn internal(error: impl Into<Box<dyn Error + Send + Sync>>) -> Self {
        let error = error.into();
        tracing::error!(error = %error, "internal server error");
        Self::Internal(error)
    }

    pub fn internal_message(message: impl Into<String>) -> Self {
        Self::internal(std::io::Error::other(message.into()))
    }
}

impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        Self::internal(error)
    }
}

impl From<redis::RedisError> for AppError {
    fn from(error: redis::RedisError) -> Self {
        tracing::error!(
            kind = ?error.kind(),
            category = ?error.category(),
            "redis operation failed"
        );
        Self::Internal(Box::new(error))
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message, details) = self.parts();
        let body = ErrorResponse {
            error: ErrorBody {
                code: code.to_owned(),
                message: message.to_owned(),
                details,
            },
        };

        let mut response = (status, Json(body)).into_response();
        response
            .headers_mut()
            .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
        response
    }
}

impl AppError {
    fn parts(&self) -> (StatusCode, &'static str, &str, Option<String>) {
        match self {
            Self::BadRequest(message) => (StatusCode::BAD_REQUEST, "bad_request", message, None),
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "Authentication is required.",
                None,
            ),
            Self::Forbidden => (
                StatusCode::FORBIDDEN,
                "forbidden",
                "You do not have permission to perform this action.",
                None,
            ),
            Self::NotFound => (
                StatusCode::NOT_FOUND,
                "not_found",
                "The requested resource was not found.",
                None,
            ),
            Self::MethodNotAllowed => (
                StatusCode::METHOD_NOT_ALLOWED,
                "method_not_allowed",
                "The requested method is not allowed for this resource.",
                None,
            ),
            Self::Conflict => (
                StatusCode::CONFLICT,
                "conflict",
                "The request conflicts with the current state of the resource.",
                None,
            ),
            Self::Validation(reason) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "validation_error",
                "The request could not be validated.",
                Some(reason.clone()),
            ),
            Self::TooManyRequests => (
                StatusCode::TOO_MANY_REQUESTS,
                "too_many_requests",
                "Too many requests. Please try again later.",
                None,
            ),
            Self::RequestTimeout => (
                StatusCode::GATEWAY_TIMEOUT,
                "request_timeout",
                "The request took too long to process.",
                None,
            ),
            Self::ServiceUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "service_unavailable",
                "The service is temporarily unavailable.",
                None,
            ),
            Self::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "An internal error occurred.",
                None,
            ),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorResponse {
    pub error: ErrorBody,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}
