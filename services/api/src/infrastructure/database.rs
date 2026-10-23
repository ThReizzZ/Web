use std::time::Duration;

use sqlx::{PgPool, postgres::PgPoolOptions};
use thiserror::Error;
use tokio::time::timeout;

use crate::config::DatabaseSettings;

#[derive(Debug, Error)]
pub enum DatabaseInitError {
    #[error("PostgreSQL is unavailable or rejected the connection")]
    Unavailable(#[source] sqlx::Error),
    #[error("timed out while connecting to PostgreSQL")]
    Timeout,
}

/// Creates the shared `PostgreSQL` pool.
///
/// Startup fails with a generic (non-credential-bearing) error when `PostgreSQL`
/// cannot be reached. Schema migrations are intentionally not run here; they
/// are executed by the dedicated `migrate` binary before the API starts.
pub async fn connect(settings: &DatabaseSettings) -> Result<PgPool, DatabaseInitError> {
    let pool_options = PgPoolOptions::new()
        .max_connections(settings.max_connections)
        .min_connections(settings.min_connections)
        .acquire_timeout(settings.acquire_timeout);

    match timeout(
        settings.connect_timeout,
        pool_options.connect(&settings.url),
    )
    .await
    {
        Ok(Ok(pool)) => {
            tracing::info!(
                max_connections = settings.max_connections,
                min_connections = settings.min_connections,
                "PostgreSQL pool ready"
            );
            Ok(pool)
        }
        Ok(Err(error)) => Err(DatabaseInitError::Unavailable(error)),
        Err(_) => Err(DatabaseInitError::Timeout),
    }
}

/// Lightweight readiness probe. Never returns error details to callers.
pub async fn is_ready(pool: &PgPool, probe_timeout: Duration) -> bool {
    matches!(
        timeout(probe_timeout, sqlx::query("SELECT 1").execute(pool)).await,
        Ok(Ok(_))
    )
}
