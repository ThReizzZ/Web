use std::time::Instant;

use redis::aio::ConnectionManager;
use sqlx::PgPool;
use tokio::sync::broadcast;

/// Shared, cheaply cloneable application state.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: Option<ConnectionManager>,
    pub redis_required: bool,
    pub environment: &'static str,
    pub started_at: Instant,
    /// Broadcasts server IDs after a successful plugin report so SSE clients
    /// can refresh their rosters immediately.
    pub server_updates: broadcast::Sender<String>,
}

impl AppState {
    #[must_use]
    pub fn new(
        db: PgPool,
        redis: Option<ConnectionManager>,
        redis_required: bool,
        environment: &'static str,
    ) -> Self {
        let (server_updates, _) = broadcast::channel(64);
        Self {
            db,
            redis,
            redis_required,
            environment,
            started_at: Instant::now(),
            server_updates,
        }
    }

    #[must_use]
    pub fn uptime_seconds(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}
