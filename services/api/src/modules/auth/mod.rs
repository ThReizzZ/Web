use std::{collections::HashMap, net::IpAddr};

use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::{
        HeaderMap, HeaderValue, StatusCode,
        header::{CACHE_CONTROL, COOKIE, SET_COOKIE},
    },
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use url::Url;
use uuid::Uuid;

use crate::{config::AuthSettings, errors::AppError, state::AppState};

mod steam;

const STEAM_OPENID_ENDPOINT: &str = "https://steamcommunity.com/openid/login";
const STEAM_CLAIMED_ID_PREFIX: &str = "https://steamcommunity.com/openid/id/";
const STEAM_CLAIMED_ID_PREFIX_HTTP: &str = "http://steamcommunity.com/openid/id/";
const SESSION_COOKIE: &str = "threi_session";

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct AuthUser {
    pub id: Uuid,
    pub steam_id64: String,
    pub persona_name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub bio: String,
    pub location: String,
    pub is_disabled: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeUser {
    pub steam_id64: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub bio: String,
    pub location: String,
    pub joined_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
}

impl From<AuthUser> for MeUser {
    fn from(user: AuthUser) -> Self {
        Self {
            steam_id64: user.steam_id64,
            name: user.persona_name,
            avatar_url: user.avatar_url,
            role: user.role,
            bio: user.bio,
            location: user.location,
            joined_at: user.created_at,
            last_login_at: user.last_login_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub user: Option<MeUser>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/steam/login", get(steam_login))
        .route("/auth/steam/callback", get(steam_callback))
        .route("/auth/magic", get(magic_login))
        .route("/auth/me", get(me))
        .route("/auth/logout", post(logout))
}

/// Redirects the browser to Steam `OpenID`. Steam is the only supported login
/// method; there is no local password flow.
#[utoipa::path(
    get,
    path = "/api/v1/auth/steam/login",
    tag = "auth",
    responses((status = 307, description = "Redirect to Steam OpenID"))
)]
async fn steam_login(Extension(settings): Extension<AuthSettings>) -> Result<Redirect, AppError> {
    let mut url = Url::parse(STEAM_OPENID_ENDPOINT).map_err(|error| {
        AppError::internal_message(format!("invalid Steam OpenID endpoint: {error}"))
    })?;
    url.query_pairs_mut()
        .append_pair("openid.ns", "http://specs.openid.net/auth/2.0")
        .append_pair("openid.mode", "checkid_setup")
        .append_pair("openid.return_to", &settings.steam_return_url)
        .append_pair("openid.realm", &settings.steam_realm)
        .append_pair(
            "openid.identity",
            "http://specs.openid.net/auth/2.0/identifier_select",
        )
        .append_pair(
            "openid.claimed_id",
            "http://specs.openid.net/auth/2.0/identifier_select",
        );

    Ok(Redirect::temporary(url.as_str()))
}

/// Steam redirects back here. The assertion is verified with Steam's `OpenID`
/// endpoint before the `SteamID` in `claimed_id` is trusted.
#[utoipa::path(
    get,
    path = "/api/v1/auth/steam/callback",
    tag = "auth",
    responses((status = 303, description = "Set session cookie and redirect to the account page"))
)]
async fn steam_callback(
    State(state): State<AppState>,
    Extension(settings): Extension<AuthSettings>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let ip_address = client_ip(&headers);
    match complete_steam_login(&state, &settings, params, ip_address.as_deref()).await {
        Ok((_user, token)) => {
            let mut response =
                Redirect::to(&format!("{}/account", settings.web_url)).into_response();
            response.headers_mut().insert(
                SET_COOKIE,
                HeaderValue::from_str(&session_cookie(&token, &settings))
                    .unwrap_or_else(|_| HeaderValue::from_static("")),
            );
            response
                .headers_mut()
                .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
            response
        }
        Err(error) => {
            tracing::warn!(error = %error, "Steam login failed");
            redirect_with_error(&settings, "steam_login_failed")
        }
    }
}

#[allow(clippy::too_many_lines)]
async fn complete_steam_login(
    state: &AppState,
    settings: &AuthSettings,
    params: HashMap<String, String>,
    ip_address: Option<&str>,
) -> Result<(AuthUser, String), AppError> {
    if params.get("openid.mode").map(String::as_str) != Some("id_res") {
        return Err(AppError::bad_request(
            "Steam did not return an OpenID assertion",
        ));
    }
    if let Some(return_to) = params.get("openid.return_to")
        && return_to != &settings.steam_return_url
    {
        return Err(AppError::bad_request("Unexpected Steam return URL"));
    }

    let claimed_id = params
        .get("openid.claimed_id")
        .ok_or_else(|| AppError::bad_request("Steam assertion did not include a claimed ID"))?;
    let steam_id64 = extract_steam_id(claimed_id)
        .ok_or_else(|| AppError::bad_request("Steam claimed ID is not a valid SteamID64"))?;

    let (persona_name, avatar_url) = if settings.steam_skip_openid_verification {
        tracing::warn!(
            steam_id64 = %steam_id64,
            "STEAM_SKIP_OPENID_VERIFICATION is enabled; accepting an unverified Steam assertion (development only)"
        );
        steam_profile_fallback(&steam_id64)
    } else {
        verify_openid_assertion(settings, &params).await?;
        fetch_steam_profile(settings, &steam_id64).await
    };
    let role = if settings.admin_steam_ids.iter().any(|id| id == &steam_id64) {
        "admin"
    } else {
        "member"
    };

    let user = sqlx::query_as::<_, AuthUser>(
        r"
        INSERT INTO users (steam_id64, persona_name, avatar_url, role, last_login_at, last_login_ip)
        VALUES ($1, $2, $3, $4, now(), $5)
        ON CONFLICT (steam_id64) DO UPDATE SET
            persona_name = EXCLUDED.persona_name,
            avatar_url = EXCLUDED.avatar_url,
            role = users.role,
            last_login_at = now(),
            last_login_ip = coalesce(EXCLUDED.last_login_ip, users.last_login_ip),
            updated_at = now()
        RETURNING id, steam_id64, persona_name, avatar_url, role, bio, location,
                  is_disabled, created_at, last_login_at
        ",
    )
    .bind(&steam_id64)
    .bind(persona_name)
    .bind(avatar_url)
    .bind(role)
    .bind(ip_address)
    .fetch_one(&state.db)
    .await?;

    if user.is_disabled {
        return Err(AppError::Forbidden);
    }

    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let token_hash = hash_token(&token);
    let expires_at = Utc::now() + ChronoDuration::days(settings.session_ttl_days);

    sqlx::query(
        "INSERT INTO sessions (token_hash, user_id, expires_at, ip_address) VALUES ($1, $2, $3, $4)",
    )
    .bind(token_hash)
    .bind(user.id)
    .bind(expires_at)
    .bind(ip_address)
    .execute(&state.db)
    .await?;

    Ok((user, token))
}

/// Exchanges a single-use session token created by the `magic-link` operator
/// binary for a normal admin session. This is an operational recovery path for
/// deployments where Steam is temporarily unreachable; it is not a general
/// login method.
#[utoipa::path(
    get,
    path = "/api/v1/auth/magic",
    tag = "auth",
    responses((status = 303, description = "Set session cookie and redirect to the account page"))
)]
async fn magic_login(
    State(state): State<AppState>,
    Extension(settings): Extension<AuthSettings>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let ip_address = client_ip(&headers);
    match exchange_magic_token(
        &state,
        &settings,
        params.get("token").map(String::as_str),
        ip_address.as_deref(),
    )
    .await
    {
        Ok(token) => {
            let mut response =
                Redirect::to(&format!("{}/account", settings.web_url)).into_response();
            response.headers_mut().insert(
                SET_COOKIE,
                HeaderValue::from_str(&session_cookie(&token, &settings))
                    .unwrap_or_else(|_| HeaderValue::from_static("")),
            );
            response
                .headers_mut()
                .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
            response
        }
        Err(error) => {
            tracing::warn!(error = %error, "Magic login failed");
            redirect_with_error(&settings, "magic_login_failed")
        }
    }
}

async fn exchange_magic_token(
    state: &AppState,
    settings: &AuthSettings,
    token: Option<&str>,
    ip_address: Option<&str>,
) -> Result<String, AppError> {
    let token = token.ok_or_else(|| AppError::bad_request("missing login token"))?;
    if token.len() != 64 || !token.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(AppError::bad_request("invalid login token"));
    }

    let mut tx = state.db.begin().await?;
    let Some(user_id) = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM sessions WHERE token_hash = $1 AND expires_at > now() RETURNING user_id",
    )
    .bind(hash_token(token))
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Err(AppError::bad_request("invalid or expired login token"));
    };

    let user = sqlx::query_as::<_, AuthUser>(
        r"
        SELECT id, steam_id64, persona_name, avatar_url, role, bio, location,
               is_disabled, created_at, last_login_at
        FROM users
        WHERE id = $1
        ",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if user.role != "admin" || user.is_disabled {
        tx.commit().await?;
        return Err(AppError::Forbidden);
    }

    let new_token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let expires_at = Utc::now() + ChronoDuration::days(settings.session_ttl_days);
    sqlx::query("UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO sessions (token_hash, user_id, expires_at, ip_address) VALUES ($1, $2, $3, $4)",
    )
    .bind(hash_token(&new_token))
    .bind(user.id)
    .bind(expires_at)
    .bind(ip_address)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(new_token)
}

async fn verify_openid_assertion(
    settings: &AuthSettings,
    params: &HashMap<String, String>,
) -> Result<(), AppError> {
    let mut form = params
        .iter()
        .filter(|(key, _)| key.as_str() != "openid.mode")
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<Vec<_>>();
    form.push(("openid.mode".to_owned(), "check_authentication".to_owned()));

    let body = steam::post_form(settings, "/openid/login", &form).await?;
    if !body.lines().any(|line| line.trim() == "is_valid:true") {
        return Err(AppError::bad_request("Steam OpenID assertion is invalid"));
    }

    Ok(())
}

fn steam_profile_fallback(steam_id64: &str) -> (String, Option<String>) {
    let fallback_name = format!(
        "Steam 用户 {}",
        &steam_id64[steam_id64.len().saturating_sub(6)..]
    );
    (fallback_name, None)
}

async fn fetch_steam_profile(
    settings: &AuthSettings,
    steam_id64: &str,
) -> (String, Option<String>) {
    let (fallback_name, _) = steam_profile_fallback(steam_id64);
    let Ok(xml) = steam::get(settings, &format!("/profiles/{steam_id64}?xml=1")).await else {
        return (fallback_name, None);
    };

    let name = xml_value(&xml, "steamID").unwrap_or(fallback_name);
    let avatar = xml_value(&xml, "avatarFull").filter(|url| url.starts_with("https://"));
    (name, avatar)
}

#[utoipa::path(
    get,
    path = "/api/v1/auth/me",
    tag = "auth",
    responses((status = 200, description = "Current Steam user or null"))
)]
async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<MeResponse>, AppError> {
    let user = optional_user(&state, &headers).await?;
    Ok(Json(MeResponse {
        user: user.map(MeUser::from),
    }))
}

#[utoipa::path(
    post,
    path = "/api/v1/auth/logout",
    tag = "auth",
    responses((status = 204, description = "Session revoked"))
)]
async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<Response, AppError> {
    if let Some(token) = session_token(&headers) {
        sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
            .bind(hash_token(&token))
            .execute(&state.db)
            .await?;
    }

    let mut response = StatusCode::NO_CONTENT.into_response();
    response.headers_mut().insert(
        SET_COOKIE,
        HeaderValue::from_static("threi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"),
    );
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}

pub async fn optional_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Option<AuthUser>, AppError> {
    let Some(token) = session_token(headers) else {
        return Ok(None);
    };

    let user = sqlx::query_as::<_, AuthUser>(
        r"
        SELECT u.id, u.steam_id64, u.persona_name, u.avatar_url, u.role, u.bio,
               u.location, u.is_disabled, u.created_at, u.last_login_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()
          AND u.is_disabled = false
        ",
    )
    .bind(hash_token(&token))
    .fetch_optional(&state.db)
    .await?;

    Ok(user)
}

pub async fn require_user(state: &AppState, headers: &HeaderMap) -> Result<AuthUser, AppError> {
    optional_user(state, headers)
        .await?
        .ok_or(AppError::Unauthorized)
}

pub async fn require_admin(state: &AppState, headers: &HeaderMap) -> Result<AuthUser, AppError> {
    let user = require_user(state, headers).await?;
    if user.role != "admin" {
        return Err(AppError::Forbidden);
    }
    Ok(user)
}

/// Best-effort client IP from the reverse proxy headers.
///
/// Caddy sits in front of Nginx in production, so Nginx's `X-Real-IP` is
/// `127.0.0.1`; the original client is the first non-loopback entry of
/// `X-Forwarded-For`. When the API is reached directly through Nginx,
/// `X-Real-IP` is the useful value.
pub fn client_ip(headers: &HeaderMap) -> Option<String> {
    fn parse(value: &str) -> Option<IpAddr> {
        value.trim().parse().ok()
    }

    if let Some(ip) = headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .and_then(parse)
        && !ip.is_loopback()
    {
        return Some(ip.to_string());
    }

    if let Some(value) = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
    {
        let mut forwarded = None;
        let mut fallback = None;
        for part in value.split(',') {
            if let Some(ip) = parse(part) {
                if ip.is_loopback() {
                    fallback.get_or_insert(ip);
                } else {
                    // Use the last non-loopback entry: Caddy is the edge proxy
                    // and Nginx appends its own loopback address. This also
                    // ignores a spoofed leading entry.
                    forwarded = Some(ip);
                }
            }
        }
        if let Some(ip) = forwarded.or(fallback) {
            return Some(ip.to_string());
        }
    }

    headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .and_then(parse)
        .map(|ip| ip.to_string())
}

fn session_token(headers: &HeaderMap) -> Option<String> {
    let cookie = headers.get(COOKIE)?.to_str().ok()?;
    cookie.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        (name == SESSION_COOKIE && !value.is_empty()).then(|| value.to_owned())
    })
}

fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

fn session_cookie(token: &str, settings: &AuthSettings) -> String {
    let max_age = settings.session_ttl_days * 86_400;
    let mut cookie =
        format!("{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}");
    if settings.cookie_secure {
        cookie.push_str("; Secure");
    }
    cookie
}

fn redirect_with_error(settings: &AuthSettings, code: &str) -> Response {
    let mut url = Url::parse(&format!("{}/account", settings.web_url))
        .unwrap_or_else(|_| Url::parse("http://localhost:3000/account").expect("fallback URL"));
    url.query_pairs_mut().append_pair("steam_error", code);
    Redirect::to(url.as_str()).into_response()
}

fn extract_steam_id(claimed_id: &str) -> Option<String> {
    let id = claimed_id
        .strip_prefix(STEAM_CLAIMED_ID_PREFIX)
        .or_else(|| claimed_id.strip_prefix(STEAM_CLAIMED_ID_PREFIX_HTTP))?;
    if id.len() == 17 && id.chars().all(|c| c.is_ascii_digit()) {
        Some(id.to_owned())
    } else {
        None
    }
}

fn xml_value(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    let value = xml[start..end].trim();
    let value = value
        .strip_prefix("<![CDATA[")
        .and_then(|value| value.strip_suffix("]]>"))
        .unwrap_or(value)
        .trim();
    (!value.is_empty()).then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_steam_id_from_claimed_id() {
        assert_eq!(
            extract_steam_id("https://steamcommunity.com/openid/id/76561197960287930"),
            Some("76561197960287930".to_owned())
        );
        assert_eq!(extract_steam_id("https://example.com/openid/id/765"), None);
        assert_eq!(extract_steam_id("not a URL"), None);
    }

    #[test]
    fn client_ip_prefers_public_real_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", HeaderValue::from_static("203.0.113.10"));
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("198.51.100.2, 127.0.0.1"),
        );
        assert_eq!(client_ip(&headers).as_deref(), Some("203.0.113.10"));
    }

    #[test]
    fn client_ip_uses_last_public_forwarded_entry() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", HeaderValue::from_static("127.0.0.1"));
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("198.51.100.2, 203.0.113.10, 127.0.0.1"),
        );
        assert_eq!(client_ip(&headers).as_deref(), Some("203.0.113.10"));
    }

    #[test]
    fn reads_cdata_xml_values() {
        let xml = r"<profile><steamID><![CDATA[Test User]]></steamID><avatarFull><![CDATA[https://example.com/a.jpg]]></avatarFull></profile>";
        assert_eq!(xml_value(xml, "steamID").as_deref(), Some("Test User"));
        assert_eq!(
            xml_value(xml, "avatarFull").as_deref(),
            Some("https://example.com/a.jpg")
        );
    }

    #[test]
    fn session_cookie_is_http_only_and_secure_in_production() {
        let settings = AuthSettings {
            web_url: "https://example.com".to_owned(),
            steam_return_url: "https://example.com/api/v1/auth/steam/callback".to_owned(),
            steam_realm: "https://example.com".to_owned(),
            steam_community_base_url: "https://steamcommunity.com".to_owned(),
            steam_community_ip: None,
            cookie_secure: true,
            session_ttl_days: 30,
            admin_steam_ids: Vec::new(),
            steam_skip_openid_verification: false,
        };
        let cookie = session_cookie("secret", &settings);
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Lax"));
        assert!(cookie.contains("Secure"));
    }
}
