use std::{env, process::ExitCode};

use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use sqlx::{Row, postgres::PgPoolOptions};
use uuid::Uuid;

const DEFAULT_TTL_SECONDS: i64 = 600;

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("magic-link: {error}");
            ExitCode::FAILURE
        }
    }
}

#[allow(clippy::too_many_lines)]
async fn run() -> Result<(), String> {
    let mut steam_id: Option<String> = None;
    let mut ttl_seconds = DEFAULT_TTL_SECONDS;
    let mut persona_name = String::from("ThRei 管理员");
    let mut base_url = env::var("WEB_URL").or_else(|_| env::var("SITE_URL")).ok();
    let mut promote = false;

    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--steam-id" => steam_id = args.next(),
            "--ttl-seconds" => {
                ttl_seconds = args
                    .next()
                    .and_then(|value| value.parse::<i64>().ok())
                    .filter(|value| (60..=3600).contains(value))
                    .ok_or_else(|| "--ttl-seconds must be between 60 and 3600".to_owned())?;
            }
            "--name" => {
                persona_name = args
                    .next()
                    .ok_or_else(|| "--name requires a value".to_owned())?;
            }
            "--url" => base_url = args.next(),
            "--promote" => promote = true,
            "--help" | "-h" => {
                print_help();
                return Ok(());
            }
            other => return Err(format!("unknown argument: {other}")),
        }
    }

    let steam_id = steam_id
        .or_else(|| {
            env::var("ADMIN_STEAM_IDS").ok().and_then(|value| {
                value
                    .split(',')
                    .map(str::trim)
                    .find(|value| !value.is_empty())
                    .map(str::to_owned)
            })
        })
        .ok_or_else(|| "provide --steam-id or set ADMIN_STEAM_IDS".to_owned())?;
    if steam_id.len() != 17 || !steam_id.chars().all(|character| character.is_ascii_digit()) {
        return Err(format!("`{steam_id}` is not a 17-digit SteamID64"));
    }

    let base_url = base_url.ok_or_else(|| {
        "set WEB_URL (or pass --url) so the link uses the public origin".to_owned()
    })?;
    let base_url = base_url.trim_end_matches('/').to_owned();
    if !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
        return Err("WEB_URL/--url must start with http:// or https://".to_owned());
    }

    let persona_name = persona_name.trim();
    let persona_name = if persona_name.is_empty() {
        "ThRei 管理员"
    } else {
        persona_name
    };
    let persona_name = persona_name.chars().take(80).collect::<String>();

    let database_url =
        env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required".to_owned())?;
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .map_err(|error| format!("could not connect to PostgreSQL: {error}"))?;

    let existing = sqlx::query("SELECT id, role, is_disabled FROM users WHERE steam_id64 = $1")
        .bind(&steam_id)
        .fetch_optional(&pool)
        .await
        .map_err(|error| format!("could not read the user: {error}"))?;

    let user_id: Uuid = match existing {
        Some(row) => {
            let id: Uuid = row.get("id");
            let role: String = row.get("role");
            let is_disabled: bool = row.get("is_disabled");
            if is_disabled {
                return Err(format!(
                    "user {steam_id} is disabled; refusing to create a login link"
                ));
            }
            if role != "admin" {
                if !promote {
                    return Err(format!(
                        "user {steam_id} has role `{role}`; pass --promote to make them an admin"
                    ));
                }
                sqlx::query("UPDATE users SET role = 'admin', updated_at = now() WHERE id = $1")
                    .bind(id)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("could not promote the user: {error}"))?;
                eprintln!("promoted user {steam_id} to admin");
            }
            id
        }
        None => sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO users (steam_id64, persona_name, role, last_login_at)
             VALUES ($1, $2, 'admin', now()) RETURNING id",
        )
        .bind(&steam_id)
        .bind(&persona_name)
        .fetch_one(&pool)
        .await
        .map_err(|error| format!("could not create the admin user: {error}"))?,
    };

    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let token_hash = hex::encode(Sha256::digest(token.as_bytes()));
    let expires_at = Utc::now() + Duration::seconds(ttl_seconds);
    sqlx::query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)")
        .bind(token_hash)
        .bind(user_id)
        .bind(expires_at)
        .execute(&pool)
        .await
        .map_err(|error| format!("could not create the login token: {error}"))?;

    println!("One-time admin login link (valid for {ttl_seconds} seconds, single use):");
    println!("{base_url}/api/v1/auth/magic?token={token}");
    println!("SteamID64: {steam_id}");
    Ok(())
}

fn print_help() {
    println!(
        "Usage: magic-link [--steam-id <17-digit SteamID64>] [--ttl-seconds 60-3600] \
         [--name <display name>] [--url <public origin>] [--promote]\n\n\
         Creates a single-use admin session token. Open the printed URL in a browser \
         within the TTL. Requires DATABASE_URL; uses WEB_URL or SITE_URL for the link."
    );
}
