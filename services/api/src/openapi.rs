use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    errors::{ErrorBody, ErrorResponse},
    modules::{
        forum::{CreateReplyRequest, CreateTopicRequest},
        server_admin::{PluginTokenResponse, SetRconPasswordRequest},
        server_communities::{
            AddCommunityServersRequest, AdminCommunity, CommunityOverview, CommunityServer,
            CreateCommunityRequest, CreateCommunityResponse, UpdateCommunityRequest,
        },
        server_plugin::{PluginPlayer, PluginReportRequest, PluginReportResponse},
    },
    routes::{
        health::{
            ComponentState, LivenessResponse, ReadinessChecks, ReadinessResponse, ReadinessStatus,
        },
        system::SystemInfo,
    },
};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "ThRei API",
        version = env!("CARGO_PKG_VERSION"),
        description = "ThRei community API. Business endpoints are versioned under /api/v1. Health endpoints are infrastructure-only and are not routed through the public Nginx entry point."
    ),
    paths(
        crate::routes::health::live,
        crate::routes::health::ready,
        crate::routes::system::info,
        crate::modules::auth::steam_login,
        crate::modules::auth::steam_callback,
        crate::modules::auth::magic_login,
        crate::modules::auth::me,
        crate::modules::auth::logout,
        crate::modules::servers::list_servers,
        crate::modules::server_plugin::report,
        crate::modules::plugin_access::access_snapshot,
        crate::modules::plugin_access::actions,
        crate::modules::plugin_access::ack_action,
        crate::modules::server_admin::get_plugin_token,
        crate::modules::server_admin::rotate_plugin_token,
        crate::modules::server_admin::clear_plugin_token,
        crate::modules::server_admin::set_rcon_password,
        crate::modules::server_admin::clear_rcon_password,
        crate::modules::server_communities::overview,
        crate::modules::server_communities::create_community,
        crate::modules::server_communities::update_community,
        crate::modules::server_communities::delete_community,
        crate::modules::server_communities::add_servers,
        crate::modules::server_communities::remove_server,
        crate::modules::forum::list_categories,
        crate::modules::forum::list_topics,
        crate::modules::forum::create_topic,
        crate::modules::forum::get_topic,
        crate::modules::forum::create_reply,
        crate::modules::forum::list_active_users,
        crate::modules::players::list_players,
        crate::modules::players::get_player,
        crate::modules::community::overview,
        crate::modules::account::account_overview,
        crate::modules::account::update_profile,
        crate::modules::admin::overview
    ),
    components(schemas(
        LivenessResponse,
        ReadinessResponse,
        ReadinessChecks,
        ReadinessStatus,
        ComponentState,
        SystemInfo,
        ErrorResponse,
        ErrorBody,
        PluginReportRequest,
        CreateTopicRequest,
        CreateReplyRequest,
        crate::modules::account::UpdateProfileRequest,
        PluginPlayer,
        PluginReportResponse,
        PluginTokenResponse,
        SetRconPasswordRequest,
        CommunityOverview,
        AdminCommunity,
        CommunityServer,
        CreateCommunityRequest,
        CreateCommunityResponse,
        UpdateCommunityRequest,
        AddCommunityServersRequest
    )),
    tags(
        (name = "health", description = "Liveness and readiness probes"),
        (name = "system", description = "Public service metadata"),
        (name = "auth", description = "Steam OpenID login and cookie sessions"),
        (name = "servers", description = "KZ server directory and live players"),
        (name = "plugin", description = "Authenticated reports from ThRei_Players"),
        (name = "forum", description = "Forum categories, topics and replies"),
        (name = "community", description = "Community-wide statistics"),
        (name = "account", description = "Authenticated user account"),
        (name = "admin", description = "Admin-only operational data")
    )
)]
pub struct ApiDoc;

/// `OpenAPI` JSON plus Swagger UI. Mounted only when `API_DOCS_ENABLED=true`.
pub fn docs_router() -> Router {
    Router::new()
        .merge(SwaggerUi::new("/api/v1/docs").url("/api/v1/openapi.json", ApiDoc::openapi()))
}
