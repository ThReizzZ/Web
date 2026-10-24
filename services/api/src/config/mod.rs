use std::{env, fmt::Display, str::FromStr, time::Duration};

use axum::http::HeaderValue;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Development,
    Test,
    Production,
}

impl Environment {
    pub fn parse(value: &str) -> Result<Self, ConfigError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "development" | "dev" => Ok(Self::Development),
            "test" => Ok(Self::Test),
            "production" | "prod" => Ok(Self::Production),
            other => Err(ConfigError::Invalid(
                "APP_ENV",
                format!("expected development, test or production, got `{other}`"),
            )),
        }
    }

    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Test => "test",
            Self::Production => "production",
        }
    }

    #[must_use]
    pub fn is_production(self) -> bool {
        self == Self::Production
    }
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("required environment variable {0} is missing")]
    Missing(&'static str),
    #[error("environment variable {0} is invalid: {1}")]
    Invalid(&'static str, String),
    #[error("REDIS_REQUIRED=true requires REDIS_URL to be configured")]
    RedisRequiredWithoutUrl,
}

/// Application settings.
///
/// Deliberately does not derive `Debug`: this struct contains database and
/// Redis URLs with credentials. Log only the individual fields that are safe.
#[derive(Clone)]
pub struct Settings {
    pub environment: Environment,
    pub http: HttpSettings,
    pub database: DatabaseSettings,
    pub redis: RedisSettings,
    pub auth: AuthSettings,
    pub observability: ObservabilitySettings,
}

impl Settings {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|key| env::var(key).ok())
    }

    pub fn from_lookup<F>(lookup: F) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let environment = Environment::parse(
            &optional(&lookup, "APP_ENV").unwrap_or_else(|| "development".to_owned()),
        )?;

        Ok(Self {
            environment,
            http: HttpSettings::from_lookup(&lookup, environment)?,
            database: DatabaseSettings::from_lookup(&lookup)?,
            redis: RedisSettings::from_lookup(&lookup, environment)?,
            auth: AuthSettings::from_lookup(&lookup, environment)?,
            observability: ObservabilitySettings::from_lookup(&lookup, environment)?,
        })
    }
}

#[derive(Clone)]
pub struct HttpSettings {
    pub host: String,
    pub port: u16,
    pub request_timeout: Duration,
    pub body_limit_bytes: usize,
    pub cors_allowed_origins: Vec<String>,
    pub docs_enabled: bool,
}

impl HttpSettings {
    fn from_lookup<F>(lookup: &F, environment: Environment) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let host = optional(lookup, "API_HOST").unwrap_or_else(|| "0.0.0.0".to_owned());
        let port = number(lookup, "API_PORT", 8080_u16)?;
        let request_timeout_secs = number(lookup, "REQUEST_TIMEOUT_SECS", 30_u64)?;
        let body_limit_bytes = number(lookup, "REQUEST_BODY_LIMIT_BYTES", 1_048_576_usize)?;

        if request_timeout_secs == 0 {
            return Err(ConfigError::Invalid(
                "REQUEST_TIMEOUT_SECS",
                "must be greater than zero".to_owned(),
            ));
        }
        if body_limit_bytes == 0 {
            return Err(ConfigError::Invalid(
                "REQUEST_BODY_LIMIT_BYTES",
                "must be greater than zero".to_owned(),
            ));
        }

        let cors_allowed_origins = parse_origins(optional(lookup, "CORS_ALLOWED_ORIGINS"))?;
        let docs_enabled =
            optional_bool(lookup, "API_DOCS_ENABLED")?.unwrap_or(!environment.is_production());

        Ok(Self {
            host,
            port,
            request_timeout: Duration::from_secs(request_timeout_secs),
            body_limit_bytes,
            cors_allowed_origins,
            docs_enabled,
        })
    }
}

#[derive(Clone)]
pub struct DatabaseSettings {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout: Duration,
    pub connect_timeout: Duration,
}

impl DatabaseSettings {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(&|key| env::var(key).ok())
    }

    pub fn from_lookup<F>(lookup: &F) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let url = required(lookup, "DATABASE_URL")?;
        if !(url.starts_with("postgres://") || url.starts_with("postgresql://")) {
            return Err(ConfigError::Invalid(
                "DATABASE_URL",
                "must start with postgres:// or postgresql://".to_owned(),
            ));
        }

        let max_connections = number(lookup, "DATABASE_MAX_CONNECTIONS", 10_u32)?;
        let min_connections = number(lookup, "DATABASE_MIN_CONNECTIONS", 1_u32)?;
        let acquire_timeout_secs = number(lookup, "DATABASE_ACQUIRE_TIMEOUT_SECS", 5_u64)?;
        let connect_timeout_secs = number(lookup, "DATABASE_CONNECT_TIMEOUT_SECS", 5_u64)?;

        if max_connections == 0 {
            return Err(ConfigError::Invalid(
                "DATABASE_MAX_CONNECTIONS",
                "must be greater than zero".to_owned(),
            ));
        }
        if min_connections > max_connections {
            return Err(ConfigError::Invalid(
                "DATABASE_MIN_CONNECTIONS",
                "must not exceed DATABASE_MAX_CONNECTIONS".to_owned(),
            ));
        }
        if acquire_timeout_secs == 0 || connect_timeout_secs == 0 {
            return Err(ConfigError::Invalid(
                "DATABASE_ACQUIRE_TIMEOUT_SECS",
                "timeouts must be greater than zero".to_owned(),
            ));
        }

        Ok(Self {
            url,
            max_connections,
            min_connections,
            acquire_timeout: Duration::from_secs(acquire_timeout_secs),
            connect_timeout: Duration::from_secs(connect_timeout_secs),
        })
    }
}

#[derive(Clone)]
pub struct RedisSettings {
    pub url: Option<String>,
    pub required: bool,
    pub connect_timeout: Duration,
}

impl RedisSettings {
    fn from_lookup<F>(lookup: &F, environment: Environment) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let url = optional(lookup, "REDIS_URL");
        if let Some(value) = url.as_deref()
            && !(value.starts_with("redis://") || value.starts_with("rediss://"))
        {
            return Err(ConfigError::Invalid(
                "REDIS_URL",
                "must start with redis:// or rediss://".to_owned(),
            ));
        }

        let required =
            optional_bool(lookup, "REDIS_REQUIRED")?.unwrap_or(environment.is_production());
        if required && url.is_none() {
            return Err(ConfigError::RedisRequiredWithoutUrl);
        }

        let connect_timeout_secs = number(lookup, "REDIS_CONNECT_TIMEOUT_SECS", 5_u64)?;
        if connect_timeout_secs == 0 {
            return Err(ConfigError::Invalid(
                "REDIS_CONNECT_TIMEOUT_SECS",
                "must be greater than zero".to_owned(),
            ));
        }

        Ok(Self {
            url,
            required,
            connect_timeout: Duration::from_secs(connect_timeout_secs),
        })
    }
}

#[derive(Clone)]
pub struct AuthSettings {
    pub web_url: String,
    pub steam_return_url: String,
    pub steam_realm: String,
    pub cookie_secure: bool,
    pub session_ttl_days: i64,
    pub admin_steam_ids: Vec<String>,
    /// Development-only escape hatch for hosts that cannot reach
    /// `steamcommunity.com`. Refused outside `APP_ENV=development`.
    pub steam_skip_openid_verification: bool,
}

impl AuthSettings {
    fn from_lookup<F>(lookup: &F, environment: Environment) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let configured_web_url = optional(lookup, "WEB_URL");
        if environment.is_production() && configured_web_url.is_none() {
            return Err(ConfigError::Missing("WEB_URL"));
        }
        let web_url = configured_web_url
            .unwrap_or_else(|| "http://localhost:3000".to_owned())
            .trim_end_matches('/')
            .to_owned();
        validate_http_url("WEB_URL", &web_url)?;

        let steam_return_url = optional(lookup, "STEAM_RETURN_URL")
            .unwrap_or_else(|| format!("{web_url}/api/v1/auth/steam/callback"));
        validate_http_url("STEAM_RETURN_URL", &steam_return_url)?;

        let steam_realm = optional(lookup, "STEAM_REALM").unwrap_or_else(|| web_url.clone());
        validate_http_url("STEAM_REALM", &steam_realm)?;

        let session_ttl_days = number(lookup, "SESSION_TTL_DAYS", 30_i64)?;
        if session_ttl_days <= 0 || session_ttl_days > 365 {
            return Err(ConfigError::Invalid(
                "SESSION_TTL_DAYS",
                "must be between 1 and 365".to_owned(),
            ));
        }

        let admin_steam_ids = optional(lookup, "ADMIN_STEAM_IDS")
            .map(|value| {
                value
                    .split(',')
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if let Some(invalid) = admin_steam_ids
            .iter()
            .find(|steam_id| steam_id.len() != 17 || !steam_id.chars().all(|c| c.is_ascii_digit()))
        {
            return Err(ConfigError::Invalid(
                "ADMIN_STEAM_IDS",
                format!("`{invalid}` is not a 17-digit SteamID64"),
            ));
        }

        let steam_skip_openid_verification =
            optional_bool(lookup, "STEAM_SKIP_OPENID_VERIFICATION")?.unwrap_or(false);
        if steam_skip_openid_verification && environment != Environment::Development {
            return Err(ConfigError::Invalid(
                "STEAM_SKIP_OPENID_VERIFICATION",
                "only allowed when APP_ENV=development".to_owned(),
            ));
        }

        Ok(Self {
            web_url,
            steam_return_url,
            steam_realm,
            cookie_secure: optional_bool(lookup, "COOKIE_SECURE")?
                .unwrap_or(environment.is_production()),
            session_ttl_days,
            admin_steam_ids,
            steam_skip_openid_verification,
        })
    }
}

fn validate_http_url(key: &'static str, value: &str) -> Result<(), ConfigError> {
    if !(value.starts_with("http://") || value.starts_with("https://")) {
        return Err(ConfigError::Invalid(
            key,
            "must start with http:// or https://".to_owned(),
        ));
    }
    if value.contains(char::is_whitespace) {
        return Err(ConfigError::Invalid(
            key,
            "must not contain whitespace".to_owned(),
        ));
    }
    Ok(())
}

#[derive(Clone)]
pub struct ObservabilitySettings {
    pub log_filter: String,
    pub log_json: bool,
}

impl ObservabilitySettings {
    fn from_lookup<F>(lookup: &F, environment: Environment) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let log_filter = optional(lookup, "RUST_LOG").unwrap_or_else(|| {
            if environment.is_production() {
                "info".to_owned()
            } else {
                "threi_api=debug,tower_http=debug,info".to_owned()
            }
        });
        let log_json = optional_bool(lookup, "LOG_JSON")?.unwrap_or(environment.is_production());

        Ok(Self {
            log_filter,
            log_json,
        })
    }
}

fn optional<F>(lookup: &F, key: &str) -> Option<String>
where
    F: Fn(&str) -> Option<String>,
{
    lookup(key)
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn required<F>(lookup: &F, key: &'static str) -> Result<String, ConfigError>
where
    F: Fn(&str) -> Option<String>,
{
    optional(lookup, key).ok_or(ConfigError::Missing(key))
}

fn number<F, T>(lookup: &F, key: &'static str, default: T) -> Result<T, ConfigError>
where
    F: Fn(&str) -> Option<String>,
    T: FromStr,
    T::Err: Display,
{
    match optional(lookup, key) {
        Some(value) => value
            .parse::<T>()
            .map_err(|error| ConfigError::Invalid(key, error.to_string())),
        None => Ok(default),
    }
}

fn optional_bool<F>(lookup: &F, key: &'static str) -> Result<Option<bool>, ConfigError>
where
    F: Fn(&str) -> Option<String>,
{
    optional(lookup, key)
        .map(|value| match value.to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" => Ok(true),
            "false" | "0" | "no" => Ok(false),
            _ => Err(ConfigError::Invalid(
                key,
                "expected true or false".to_owned(),
            )),
        })
        .transpose()
}

fn parse_origins(value: Option<String>) -> Result<Vec<String>, ConfigError> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };

    let mut origins = Vec::new();
    for raw in value.split(',') {
        let origin = raw.trim().trim_end_matches('/');
        if origin.is_empty() {
            continue;
        }

        let has_valid_scheme = origin.starts_with("http://") || origin.starts_with("https://");
        if !has_valid_scheme || HeaderValue::from_str(origin).is_err() {
            return Err(ConfigError::Invalid(
                "CORS_ALLOWED_ORIGINS",
                format!("`{origin}` is not a valid http(s) origin"),
            ));
        }

        if !origins.iter().any(|existing| existing == origin) {
            origins.push(origin.to_owned());
        }
    }

    Ok(origins)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    fn load(pairs: &[(&str, &str)]) -> Result<Settings, ConfigError> {
        let values: HashMap<String, String> = pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect();

        Settings::from_lookup(|key| values.get(key).cloned())
    }

    const DATABASE_URL: &str = "postgres://threi:secret@127.0.0.1:5432/threi";

    #[test]
    fn development_defaults_are_safe() {
        let settings = load(&[("APP_ENV", "development"), ("DATABASE_URL", DATABASE_URL)])
            .expect("development settings should be valid");

        assert_eq!(settings.environment, Environment::Development);
        assert!(settings.http.docs_enabled);
        assert!(!settings.redis.required);
        assert!(!settings.observability.log_json);
        assert_eq!(settings.http.port, 8080);
        assert_eq!(settings.http.cors_allowed_origins, Vec::<String>::new());
        assert_eq!(settings.auth.web_url, "http://localhost:3000");
        assert_eq!(settings.auth.session_ttl_days, 30);
        assert!(!settings.auth.cookie_secure);
        assert!(!settings.auth.steam_skip_openid_verification);
    }

    #[test]
    fn steam_verification_bypass_is_development_only() {
        let production = load(&[
            ("APP_ENV", "production"),
            ("DATABASE_URL", DATABASE_URL),
            ("REDIS_URL", "redis://:secret@redis:6379/0"),
            ("WEB_URL", "https://threi.example"),
            ("STEAM_SKIP_OPENID_VERIFICATION", "true"),
        ]);
        assert!(matches!(
            production,
            Err(ConfigError::Invalid("STEAM_SKIP_OPENID_VERIFICATION", _))
        ));

        let development = load(&[
            ("APP_ENV", "development"),
            ("DATABASE_URL", DATABASE_URL),
            ("STEAM_SKIP_OPENID_VERIFICATION", "true"),
        ])
        .expect("development bypass settings should be valid");
        assert!(development.auth.steam_skip_openid_verification);
    }

    #[test]
    fn production_defaults_disable_docs_and_require_redis() {
        let missing_redis = load(&[("APP_ENV", "production"), ("DATABASE_URL", DATABASE_URL)]);
        assert!(matches!(
            missing_redis,
            Err(ConfigError::RedisRequiredWithoutUrl)
        ));

        let settings = load(&[
            ("APP_ENV", "production"),
            ("DATABASE_URL", DATABASE_URL),
            ("REDIS_URL", "redis://:secret@redis:6379/0"),
            ("WEB_URL", "https://threi.example"),
        ])
        .expect("production settings should be valid");

        assert!(!settings.http.docs_enabled);
        assert!(settings.redis.required);
        assert!(settings.observability.log_json);
    }

    #[test]
    fn production_requires_an_explicit_web_url() {
        let result = load(&[
            ("APP_ENV", "production"),
            ("DATABASE_URL", DATABASE_URL),
            ("REDIS_URL", "redis://:secret@redis:6379/0"),
        ]);
        assert!(matches!(result, Err(ConfigError::Missing("WEB_URL"))));
    }

    #[test]
    fn admin_steam_ids_must_be_valid() {
        assert!(matches!(
            load(&[
                ("DATABASE_URL", DATABASE_URL),
                ("ADMIN_STEAM_IDS", "not-a-steam-id"),
            ]),
            Err(ConfigError::Invalid("ADMIN_STEAM_IDS", _))
        ));
    }

    #[test]
    fn database_url_is_required_and_validated() {
        assert!(matches!(
            load(&[]),
            Err(ConfigError::Missing("DATABASE_URL"))
        ));
        assert!(matches!(
            load(&[("DATABASE_URL", "mysql://localhost/threi")]),
            Err(ConfigError::Invalid("DATABASE_URL", _))
        ));
    }

    #[test]
    fn numeric_values_are_validated() {
        assert!(matches!(
            load(&[("DATABASE_URL", DATABASE_URL), ("API_PORT", "not-a-port")]),
            Err(ConfigError::Invalid("API_PORT", _))
        ));
        assert!(matches!(
            load(&[
                ("DATABASE_URL", DATABASE_URL),
                ("DATABASE_MAX_CONNECTIONS", "2"),
                ("DATABASE_MIN_CONNECTIONS", "3"),
            ]),
            Err(ConfigError::Invalid("DATABASE_MIN_CONNECTIONS", _))
        ));
    }

    #[test]
    fn cors_origins_are_normalized_and_validated() {
        let settings = load(&[
            ("DATABASE_URL", DATABASE_URL),
            (
                "CORS_ALLOWED_ORIGINS",
                "http://localhost:3000/, https://example.com, http://localhost:3000",
            ),
        ])
        .expect("cors settings should be valid");

        assert_eq!(
            settings.http.cors_allowed_origins,
            vec!["http://localhost:3000", "https://example.com"]
        );

        assert!(matches!(
            load(&[
                ("DATABASE_URL", DATABASE_URL),
                ("CORS_ALLOWED_ORIGINS", "javascript:alert(1)"),
            ]),
            Err(ConfigError::Invalid("CORS_ALLOWED_ORIGINS", _))
        ));
    }

    #[test]
    fn redis_url_scheme_is_validated() {
        assert!(matches!(
            load(&[
                ("DATABASE_URL", DATABASE_URL),
                ("REDIS_URL", "postgres://redis:6379"),
            ]),
            Err(ConfigError::Invalid("REDIS_URL", _))
        ));
    }
}
