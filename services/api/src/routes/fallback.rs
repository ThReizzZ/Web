use crate::errors::AppError;

/// Unknown paths.
pub async fn not_found() -> AppError {
    AppError::NotFound
}

/// Known paths called with an unsupported HTTP method.
pub async fn method_not_allowed() -> AppError {
    AppError::MethodNotAllowed
}
