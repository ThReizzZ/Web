pub mod fallback;
pub mod health;
pub mod system;

use axum::Router;

use crate::{modules, state::AppState};

/// Versioned business API surface mounted at `/api/v1`.
pub fn api_v1() -> Router<AppState> {
    Router::new()
        .merge(system::router())
        .merge(modules::auth::router())
        .merge(modules::servers::router())
        .merge(modules::forum::router())
        .merge(modules::community::router())
        .merge(modules::account::router())
        .merge(modules::admin::router())
        .merge(modules::admin_users::router())
        .merge(modules::bans::router())
        .merge(modules::whitelist::router())
}
