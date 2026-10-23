use std::error::Error;

use tracing_subscriber::EnvFilter;

use crate::config::ObservabilitySettings;

/// Initialises structured logging once per process.
///
/// Production defaults to JSON for container log collectors; development uses
/// the human-readable formatter. The filter comes from `RUST_LOG` and falls
/// back to `info` when the expression is invalid.
pub fn init(settings: &ObservabilitySettings) -> Result<(), Box<dyn Error + Send + Sync>> {
    let filter = EnvFilter::try_new(&settings.log_filter).unwrap_or_else(|error| {
        eprintln!("invalid RUST_LOG expression ({error}); falling back to `info`");
        EnvFilter::new("info")
    });

    if settings.log_json {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(filter)
            .with_target(true)
            .with_current_span(true)
            .with_span_list(false)
            .try_init()?;
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(filter)
            .with_target(true)
            .try_init()?;
    }

    Ok(())
}
