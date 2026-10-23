use std::time::Instant;

use redis::aio::ConnectionManager;
use sqlx::PgPool;

/// Shared, cheaply cloneable application state.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: Option<ConnectionManager>,
    pub redis_required: bool,
    pub environment: &'static str,
    pub started_at: Instant,
}

impl AppState {
    #[must_use]
    pub fn new(
        db: PgPool,
        redis: Option<ConnectionManager>,
        redis_required: bool,
        environment: &'static str,
    ) -> Self {
        Self {
            db,
            redis,
            redis_required,
            environment,
            started_at: Instant::now(),
        }
    }

    #[must_use]
    pub fn uptime_seconds(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}
