use std::process::ExitCode;

use sqlx::migrate::Migrator;
use tracing_subscriber::EnvFilter;

use threi_api::{config::DatabaseSettings, infrastructure::database};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Applies versioned, forward-only database migrations.
///
/// This is a separate binary so the API never mutates the schema during
/// startup. Failures are reported and exit non-zero; already-applied
/// migrations remain recorded in `_sqlx_migrations`.
#[tokio::main]
async fn main() -> ExitCode {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(true)
        .init();

    let settings = match DatabaseSettings::from_env() {
        Ok(settings) => settings,
        Err(error) => {
            tracing::error!(error = %error, "invalid database configuration");
            return ExitCode::FAILURE;
        }
    };

    let pool = match database::connect(&settings).await {
        Ok(pool) => pool,
        Err(error) => {
            tracing::error!(error = %error, "could not connect to PostgreSQL for migrations");
            return ExitCode::FAILURE;
        }
    };

    match MIGRATOR.run(&pool).await {
        Ok(()) => {
            tracing::info!(
                version = env!("CARGO_PKG_VERSION"),
                "database migrations applied successfully"
            );
        }
        Err(error) => {
            tracing::error!(error = %error, "database migration failed");
            pool.close().await;
            return ExitCode::FAILURE;
        }
    }

    pool.close().await;
    ExitCode::SUCCESS
}
