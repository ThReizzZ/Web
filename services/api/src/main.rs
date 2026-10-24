use std::{error::Error, process::ExitCode};

use threi_api::{
    app,
    config::Settings,
    infrastructure::{database, redis, telemetry},
    state::AppState,
};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> ExitCode {
    dotenvy::dotenv().ok();

    let settings = match Settings::from_env() {
        Ok(settings) => settings,
        Err(error) => {
            eprintln!("configuration error: {error}");
            return ExitCode::FAILURE;
        }
    };

    if let Err(error) = telemetry::init(&settings.observability) {
        eprintln!("failed to initialise logging: {error}");
        return ExitCode::FAILURE;
    }

    match run(settings).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(error = %error, "API stopped due to an error");
            ExitCode::FAILURE
        }
    }
}

async fn run(settings: Settings) -> Result<(), Box<dyn Error + Send + Sync>> {
    tracing::info!(
        environment = settings.environment.as_str(),
        host = %settings.http.host,
        port = settings.http.port,
        docs_enabled = settings.http.docs_enabled,
        "starting ThRei API"
    );

    let db = database::connect(&settings.database).await?;
    let redis = redis::connect(&settings.redis).await?;

    let state = AppState::new(
        db,
        redis,
        settings.redis.required,
        settings.environment.as_str(),
    );
    threi_api::modules::server_plugin::spawn_stale_sweeper(state.db.clone());
    let router = app::build_router(state, &settings);

    let listener = TcpListener::bind((settings.http.host.as_str(), settings.http.port)).await?;
    let local_address = listener.local_addr()?;
    tracing::info!(address = %local_address, "HTTP server listening");

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("HTTP server stopped");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(error = %error, "failed to listen for Ctrl+C");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                tracing::error!(error = %error, "failed to listen for SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    tracing::info!("shutdown signal received; draining connections");
}
