//! Optional RCON liveness fallback for empty/hibernating servers.
//!
//! CS:GO pauses game frames and `SourceMod` timers when an empty server
//! hibernates, so `ThRei_Players` cannot report even though the process is
//! perfectly reachable. When an admin stores an RCON password, this task asks
//! the console for `status` after the plugin goes stale. A successful answer
//! marks the server `hibernating` (or `online` if players are present) without
//! touching `last_reported_at`, so the admin panel can still distinguish a
//! plugin problem from a dead server.
//!
//! Only three consecutive RCON failures mark the server offline. Until then the
//! previous status is kept, which avoids flapping on a single dropped packet.

use std::time::Duration;

use sqlx::{FromRow, PgPool};
use tokio::task::JoinSet;

use crate::{
    config::HibernationSettings,
    infrastructure::rcon::{self, StatusSnapshot},
};

const MAX_SERVERS_PER_SCAN: i64 = 64;
const POLL_CONCURRENCY: usize = 8;
const OFFLINE_AFTER_FAILS: i32 = 3;

#[derive(Debug, FromRow)]
struct Candidate {
    id: String,
    host: String,
    port: i32,
    rcon_password: String,
}

pub fn spawn_hibernation_poller(db: PgPool, settings: HibernationSettings) {
    if !settings.enabled {
        tracing::info!("hibernation RCON fallback disabled");
        return;
    }

    tracing::info!(
        scan_interval_secs = settings.scan_interval.as_secs(),
        poll_interval_secs = settings.poll_interval.as_secs(),
        stale_after_secs = settings.stale_after.as_secs(),
        rcon_timeout_secs = settings.rcon_timeout.as_secs(),
        "hibernation RCON fallback started"
    );

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(settings.scan_interval);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            interval.tick().await;
            match poll_due_servers(&db, &settings).await {
                Ok(0) => {}
                Ok(count) => tracing::debug!(count, "polled stale servers over RCON"),
                Err(error) => tracing::warn!(%error, "hibernation RCON scan failed"),
            }
        }
    });
}

async fn poll_due_servers(
    db: &PgPool,
    settings: &HibernationSettings,
) -> Result<usize, sqlx::Error> {
    let candidates = sqlx::query_as::<_, Candidate>(
        r"
        SELECT id, host, port, rcon_password
        FROM servers
        WHERE is_active = true
          AND status <> 'maintenance'
          AND rcon_password IS NOT NULL
          AND (
              last_reported_at IS NULL
              OR last_reported_at < now() - make_interval(secs => $1)
          )
          AND (
              last_rcon_at IS NULL
              OR last_rcon_at < now() - make_interval(secs => $2)
          )
        ORDER BY last_rcon_at NULLS FIRST, id
        LIMIT $3
        ",
    )
    .bind(duration_secs(settings.stale_after))
    .bind(duration_secs(settings.poll_interval))
    .bind(MAX_SERVERS_PER_SCAN)
    .fetch_all(db)
    .await?;

    let count = candidates.len();
    let mut tasks = JoinSet::new();
    for candidate in candidates {
        while tasks.len() >= POLL_CONCURRENCY {
            if let Some(result) = tasks.join_next().await {
                log_join_error(result);
            }
        }
        let db = db.clone();
        let settings = settings.clone();
        tasks.spawn(async move { poll_one(&db, &candidate, &settings).await });
    }
    while let Some(result) = tasks.join_next().await {
        log_join_error(result);
    }

    Ok(count)
}

fn log_join_error(result: Result<Result<(), sqlx::Error>, tokio::task::JoinError>) {
    match result {
        Ok(Ok(())) => {}
        Ok(Err(error)) => tracing::warn!(%error, "hibernation RCON update failed"),
        Err(error) => tracing::warn!(%error, "hibernation RCON task failed"),
    }
}

async fn poll_one(
    db: &PgPool,
    candidate: &Candidate,
    settings: &HibernationSettings,
) -> Result<(), sqlx::Error> {
    let Ok(port) = u16::try_from(candidate.port) else {
        tracing::warn!(server_id = %candidate.id, port = candidate.port, "skipping RCON poll with invalid port");
        return Ok(());
    };

    match rcon::query_status(
        &candidate.host,
        port,
        &candidate.rcon_password,
        settings.rcon_timeout,
    )
    .await
    {
        Ok(snapshot) => {
            persist_success(db, candidate, settings, &snapshot).await?;
        }
        Err(error) => {
            tracing::debug!(
                server_id = %candidate.id,
                error = %error,
                "RCON liveness check failed"
            );
            persist_failure(db, candidate, settings).await?;
        }
    }
    Ok(())
}

fn snapshot_status(snapshot: &StatusSnapshot) -> &'static str {
    if snapshot.players > 0 {
        "online"
    } else {
        "hibernating"
    }
}

async fn persist_success(
    db: &PgPool,
    candidate: &Candidate,
    settings: &HibernationSettings,
    snapshot: &StatusSnapshot,
) -> Result<(), sqlx::Error> {
    let status = snapshot_status(snapshot);
    let players = i32::try_from(snapshot.players).unwrap_or(i32::MAX);
    let max_players = snapshot
        .max_players
        .and_then(|value| i32::try_from(value).ok())
        .filter(|value| (1..=1024).contains(value));

    let updated = sqlx::query(
        r"
        UPDATE servers
        SET status = $2,
            map = COALESCE($3, map),
            max_players = COALESCE($4, max_players),
            player_count = $5,
            last_rcon_at = now(),
            rcon_failures = 0,
            updated_at = now()
        WHERE id = $1
          AND status <> 'maintenance'
          AND (
              last_reported_at IS NULL
              OR last_reported_at < now() - make_interval(secs => $6)
          )
        ",
    )
    .bind(&candidate.id)
    .bind(status)
    .bind(snapshot.map.as_deref())
    .bind(max_players)
    .bind(players)
    .bind(duration_secs(settings.stale_after))
    .execute(db)
    .await?;

    if updated.rows_affected() > 0 && players == 0 {
        sqlx::query("DELETE FROM server_players WHERE server_id = $1")
            .bind(&candidate.id)
            .execute(db)
            .await?;
    }

    if updated.rows_affected() > 0 {
        tracing::debug!(
            server_id = %candidate.id,
            status,
            players,
            "RCON fallback updated server status"
        );
    }
    Ok(())
}

async fn persist_failure(
    db: &PgPool,
    candidate: &Candidate,
    settings: &HibernationSettings,
) -> Result<(), sqlx::Error> {
    let row = sqlx::query_as::<_, (String, i32)>(
        r"
        UPDATE servers
        SET rcon_failures = LEAST(rcon_failures + 1, 100),
            last_rcon_at = now(),
            status = CASE
                WHEN rcon_failures + 1 >= $2 AND status <> 'maintenance' THEN 'offline'
                ELSE status
            END,
            player_count = CASE
                WHEN rcon_failures + 1 >= $2 THEN 0
                ELSE player_count
            END,
            updated_at = now()
        WHERE id = $1
          AND status <> 'maintenance'
          AND (
              last_reported_at IS NULL
              OR last_reported_at < now() - make_interval(secs => $3)
          )
        RETURNING status, rcon_failures
        ",
    )
    .bind(&candidate.id)
    .bind(OFFLINE_AFTER_FAILS)
    .bind(duration_secs(settings.stale_after))
    .fetch_optional(db)
    .await?;

    if let Some((status, failures)) = row
        && status == "offline"
        && failures == OFFLINE_AFTER_FAILS
    {
        sqlx::query("DELETE FROM server_players WHERE server_id = $1")
            .bind(&candidate.id)
            .execute(db)
            .await?;
        tracing::info!(
            server_id = %candidate.id,
            failures,
            "server marked offline after repeated RCON failures"
        );
    }
    Ok(())
}

fn duration_secs(duration: Duration) -> f64 {
    duration.as_secs_f64()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(players: u32, hibernating: bool) -> StatusSnapshot {
        StatusSnapshot {
            hostname: None,
            map: None,
            players,
            max_players: Some(32),
            hibernating,
        }
    }

    #[test]
    fn empty_servers_are_hibernating_not_offline() {
        assert_eq!(snapshot_status(&snapshot(0, false)), "hibernating");
        assert_eq!(snapshot_status(&snapshot(0, true)), "hibernating");
    }

    #[test]
    fn populated_servers_are_online() {
        assert_eq!(snapshot_status(&snapshot(3, false)), "online");
        assert_eq!(snapshot_status(&snapshot(3, true)), "online");
    }
}
