pub mod fallback;
pub mod health;
pub mod system;

use axum::Router;

use crate::state::AppState;

/// Versioned business API surface mounted at `/api/v1`.
pub fn api_v1() -> Router<AppState> {
    Router::new().merge(system::router())
}
