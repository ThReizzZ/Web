use std::time::Duration;

use redis::{Client, aio::ConnectionManager};
use thiserror::Error;
use tokio::time::timeout;

use crate::config::RedisSettings;

#[derive(Debug, Error)]
pub enum RedisInitError {
    #[error("invalid Redis client configuration")]
    Configuration(#[source] redis::RedisError),
    #[error("Redis is unavailable")]
    Unavailable(#[source] redis::RedisError),
    #[error("timed out while connecting to Redis")]
    Timeout,
}

/// Connects the shared Redis connection manager.
///
/// Redis is optional in development and required in production by default.
/// When it is optional and unreachable, the API still starts and readiness
/// reports a degraded state; the caller receives `Ok(None)`.
pub async fn connect(
    settings: &RedisSettings,
) -> Result<Option<ConnectionManager>, RedisInitError> {
    let Some(url) = settings.url.as_deref() else {
        tracing::warn!("REDIS_URL is not configured; Redis-dependent features are disabled");
        return Ok(None);
    };

    let client = Client::open(url).map_err(RedisInitError::Configuration)?;

    match timeout(settings.connect_timeout, ConnectionManager::new(client)).await {
        Ok(Ok(manager)) => {
            tracing::info!("Redis connection manager ready");
            Ok(Some(manager))
        }
        Ok(Err(error)) if !settings.required => {
            tracing::warn!(
                kind = ?error.kind(),
                "Redis is unavailable; continuing without Redis because REDIS_REQUIRED=false"
            );
            Ok(None)
        }
        Ok(Err(error)) => Err(RedisInitError::Unavailable(error)),
        Err(_) if !settings.required => {
            tracing::warn!(
                "Redis connection timed out; continuing without Redis because REDIS_REQUIRED=false"
            );
            Ok(None)
        }
        Err(_) => Err(RedisInitError::Timeout),
    }
}

/// Readiness probe. The caller decides whether an outage is fatal.
pub async fn is_ready(manager: &ConnectionManager, probe_timeout: Duration) -> bool {
    let mut connection = manager.clone();
    matches!(
        timeout(
            probe_timeout,
            redis::cmd("PING").query_async::<String>(&mut connection)
        )
        .await,
        Ok(Ok(response)) if response == "PONG"
    )
}
