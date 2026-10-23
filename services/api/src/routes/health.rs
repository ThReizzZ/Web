use std::time::Duration;

use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde::Serialize;
use utoipa::ToSchema;

use crate::{
    infrastructure::{database, redis},
    state::AppState,
};

const PROBE_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug, Serialize, ToSchema)]
pub struct LivenessResponse {
    /// Always `ok` when the process can serve HTTP.
    pub status: String,
    pub service: String,
    pub version: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ComponentState {
    Ok,
    Unavailable,
    Disabled,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReadinessChecks {
    pub database: ComponentState,
    pub redis: ComponentState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReadinessStatus {
    Ok,
    Degraded,
    Unavailable,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReadinessResponse {
    pub status: ReadinessStatus,
    pub checks: ReadinessChecks,
    pub version: String,
    pub uptime_seconds: u64,
}

/// Process liveness. Does not touch external dependencies.
#[utoipa::path(
    get,
    path = "/health/live",
    tag = "health",
    responses(
        (status = 200, description = "Process is alive", body = LivenessResponse)
    )
)]
pub async fn live() -> Json<LivenessResponse> {
    Json(LivenessResponse {
        status: "ok".to_owned(),
        service: "threi-api".to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
    })
}

/// Dependency readiness.
///
/// `PostgreSQL` is authoritative and required. Redis is required when
/// `REDIS_REQUIRED=true`; otherwise an outage is reported as `degraded` while
/// the service keeps serving traffic. Responses never include connection
/// strings, credentials or driver error messages.
#[utoipa::path(
    get,
    path = "/health/ready",
    tag = "health",
    responses(
        (status = 200, description = "Ready, possibly with Redis degraded", body = ReadinessResponse),
        (status = 503, description = "A required dependency is unavailable", body = ReadinessResponse)
    )
)]
pub async fn ready(State(state): State<AppState>) -> impl IntoResponse {
    let (database_ok, redis_state) =
        tokio::join!(database::is_ready(&state.db, PROBE_TIMEOUT), async {
            match state.redis.as_ref() {
                None => ComponentState::Disabled,
                Some(manager) if redis::is_ready(manager, PROBE_TIMEOUT).await => {
                    ComponentState::Ok
                }
                Some(_) => ComponentState::Unavailable,
            }
        });

    let redis_unavailable = redis_state == ComponentState::Unavailable;
    let status = if !database_ok || (state.redis_required && redis_unavailable) {
        ReadinessStatus::Unavailable
    } else if redis_unavailable {
        ReadinessStatus::Degraded
    } else {
        ReadinessStatus::Ok
    };

    let http_status = if status == ReadinessStatus::Unavailable {
        StatusCode::SERVICE_UNAVAILABLE
    } else {
        StatusCode::OK
    };

    let body = ReadinessResponse {
        status,
        checks: ReadinessChecks {
            database: if database_ok {
                ComponentState::Ok
            } else {
                ComponentState::Unavailable
            },
            redis: redis_state,
        },
        version: env!("CARGO_PKG_VERSION").to_owned(),
        uptime_seconds: state.uptime_seconds(),
    };

    (http_status, Json(body))
}
