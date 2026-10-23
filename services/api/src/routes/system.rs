use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;
use utoipa::ToSchema;

use crate::state::AppState;

#[derive(Debug, Serialize, ToSchema)]
pub struct SystemInfo {
    pub name: String,
    pub version: String,
    pub environment: String,
    pub api_version: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/system/info", get(info))
}

/// Public, non-sensitive service metadata.
///
/// This endpoint is intentionally small: it lets the web client verify the API
/// connection without exposing dependency addresses or configuration.
#[utoipa::path(
    get,
    path = "/api/v1/system/info",
    tag = "system",
    responses(
        (status = 200, description = "Service metadata", body = SystemInfo)
    )
)]
pub async fn info(State(state): State<AppState>) -> Json<SystemInfo> {
    Json(SystemInfo {
        name: "threi-api".to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        environment: state.environment.to_owned(),
        api_version: "v1".to_owned(),
    })
}
