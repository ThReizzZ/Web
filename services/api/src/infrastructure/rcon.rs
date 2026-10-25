//! Minimal Source RCON client used only for liveness checks.
//!
//! `ThRei` does not expose RCON to the browser and never accepts arbitrary
//! commands. The only command this module can send is `status`; everything
//! else (whitelist, kick, ban) is handled by the authenticated plugin channel.
//! Passwords stay in the server process and are never included in errors or
//! logs.

use std::time::Duration;

use thiserror::Error;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
};

const AUTH_TYPE: i32 = 3;
const EXEC_TYPE: i32 = 2;
const RESPONSE_TYPE: i32 = 0;
const AUTH_RESPONSE_TYPE: i32 = 2;
const AUTH_FAILED_ID: i32 = -1;
const MAX_PACKET_BYTES: usize = 65_536;
const MIN_PACKET_BYTES: usize = 10;
const STATUS_ID: i32 = 2;
const DRAIN_TIMEOUT: Duration = Duration::from_millis(300);

#[derive(Debug, Error)]
pub enum RconError {
    #[error("RCON connection failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("RCON authentication failed")]
    Authentication,
    #[error("RCON returned a malformed packet")]
    Protocol,
    #[error("RCON request timed out")]
    Timeout,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusSnapshot {
    pub hostname: Option<String>,
    pub map: Option<String>,
    pub players: u32,
    pub max_players: Option<u32>,
    pub hibernating: bool,
}

/// Connects, authenticates, runs `status`, and returns the parsed snapshot.
/// `timeout` applies to the whole operation, not individual reads.
pub async fn query_status(
    host: &str,
    port: u16,
    password: &str,
    timeout: Duration,
) -> Result<StatusSnapshot, RconError> {
    if host.trim().is_empty() || password.is_empty() {
        return Err(RconError::Protocol);
    }

    match tokio::time::timeout(timeout, query_status_inner(host, port, password)).await {
        Ok(result) => result,
        Err(_) => Err(RconError::Timeout),
    }
}

async fn query_status_inner(
    host: &str,
    port: u16,
    password: &str,
) -> Result<StatusSnapshot, RconError> {
    let mut stream = TcpStream::connect((host, port)).await?;

    write_packet(&mut stream, 1, AUTH_TYPE, password.as_bytes()).await?;
    // Source servers may send an empty SERVERDATA_RESPONSE_VALUE packet before
    // the actual auth response. Ignore those envelopes and wait for the auth
    // reply (the outer timeout bounds a server that never sends one).
    let auth = loop {
        let packet = read_packet(&mut stream).await?;
        match packet.kind {
            AUTH_RESPONSE_TYPE => break packet,
            RESPONSE_TYPE => {}
            _ => return Err(RconError::Protocol),
        }
    };
    if auth.id == AUTH_FAILED_ID {
        return Err(RconError::Authentication);
    }

    write_packet(&mut stream, STATUS_ID, EXEC_TYPE, b"status").await?;
    let mut output = String::new();
    let mut got_response = false;
    loop {
        let packet = if got_response {
            match tokio::time::timeout(DRAIN_TIMEOUT, read_packet(&mut stream)).await {
                Ok(Ok(packet)) => packet,
                Ok(Err(_)) | Err(_) => break,
            }
        } else {
            read_packet(&mut stream).await?
        };
        got_response = true;
        if packet.kind == RESPONSE_TYPE && packet.id == STATUS_ID {
            output.push_str(&packet.body);
        }
    }

    if output.trim().is_empty() {
        return Err(RconError::Protocol);
    }
    parse_status(&output).ok_or(RconError::Protocol)
}

struct Packet {
    id: i32,
    kind: i32,
    body: String,
}

async fn write_packet(
    stream: &mut TcpStream,
    id: i32,
    kind: i32,
    body: &[u8],
) -> Result<(), RconError> {
    // The size prefix counts the id, type, body and two trailing NULs, but not
    // the four-byte size field itself. Including the prefix here makes a real
    // server wait forever for four bytes that never arrive.
    let size = 4 + 4 + body.len() + 2;
    if size > MAX_PACKET_BYTES {
        return Err(RconError::Protocol);
    }
    let mut packet = Vec::with_capacity(size + 4);
    let size = i32::try_from(size).map_err(|_| RconError::Protocol)?;
    packet.extend_from_slice(&size.to_le_bytes());
    packet.extend_from_slice(&id.to_le_bytes());
    packet.extend_from_slice(&kind.to_le_bytes());
    packet.extend_from_slice(body);
    packet.extend_from_slice(&[0, 0]);
    stream.write_all(&packet).await?;
    stream.flush().await?;
    Ok(())
}

async fn read_packet(stream: &mut TcpStream) -> Result<Packet, RconError> {
    let mut size_buf = [0_u8; 4];
    stream.read_exact(&mut size_buf).await?;
    let size = usize::try_from(i32::from_le_bytes(size_buf)).map_err(|_| RconError::Protocol)?;
    if !(MIN_PACKET_BYTES..=MAX_PACKET_BYTES).contains(&size) {
        return Err(RconError::Protocol);
    }

    let mut payload = vec![0_u8; size];
    stream.read_exact(&mut payload).await?;

    let id = i32::from_le_bytes(payload[0..4].try_into().map_err(|_| RconError::Protocol)?);
    let kind = i32::from_le_bytes(payload[4..8].try_into().map_err(|_| RconError::Protocol)?);
    let body = String::from_utf8_lossy(&payload[8..payload.len() - 2]).into_owned();

    Ok(Packet { id, kind, body })
}

/// Parses the console `status` output. `None` means the response was not
/// recognizable as a Source server status block (for example a proxy returned
/// an unrelated RCON banner).
pub fn parse_status(output: &str) -> Option<StatusSnapshot> {
    let mut hostname = None;
    let mut map = None;
    let mut players = None;
    let mut max_players = None;

    for line in output.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        match key {
            "hostname" if !value.is_empty() => hostname = Some(value.to_owned()),
            "map" if !value.is_empty() => map = Some(value.to_owned()),
            "players" => {
                players = parse_player_count(value);
                max_players = parse_max_players(value);
            }
            _ => {}
        }
    }

    let players = players?;
    let lowered = output.to_ascii_lowercase();
    let hibernating = lowered.contains("hibernating)") && !lowered.contains("not hibernating)");

    Some(StatusSnapshot {
        hostname,
        map,
        players,
        max_players,
        hibernating,
    })
}

fn parse_player_count(value: &str) -> Option<u32> {
    value.split_whitespace().next()?.parse::<u32>().ok()
}

fn parse_max_players(value: &str) -> Option<u32> {
    let before_max = value.split("max)").next()?;
    let open = before_max.rfind('(')?;
    before_max[open + 1..]
        .split('/')
        .next()?
        .trim()
        .parse::<u32>()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn authenticates_through_an_empty_envelope_and_reads_status() {
        use std::{
            io::{Read, Write},
            net::{TcpListener, TcpStream as StdTcpStream},
            time::Duration as StdDuration,
        };

        fn read_blocking_packet(stream: &mut StdTcpStream) -> (i32, i32, String) {
            let mut size = [0_u8; 4];
            stream.read_exact(&mut size).expect("read packet size");
            let size = usize::try_from(i32::from_le_bytes(size)).expect("positive size");
            let mut payload = vec![0_u8; size];
            stream.read_exact(&mut payload).expect("read packet body");
            let id = i32::from_le_bytes(payload[0..4].try_into().expect("id"));
            let kind = i32::from_le_bytes(payload[4..8].try_into().expect("kind"));
            let body = String::from_utf8_lossy(&payload[8..payload.len() - 2]).into_owned();
            (id, kind, body)
        }

        fn write_blocking_packet(stream: &mut StdTcpStream, id: i32, kind: i32, body: &[u8]) {
            let size = 4 + 4 + body.len() + 2;
            let mut packet = Vec::with_capacity(size + 4);
            packet.extend_from_slice(&i32::try_from(size).expect("packet fits i32").to_le_bytes());
            packet.extend_from_slice(&id.to_le_bytes());
            packet.extend_from_slice(&kind.to_le_bytes());
            packet.extend_from_slice(body);
            packet.extend_from_slice(&[0, 0]);
            stream.write_all(&packet).expect("write packet");
        }

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind fake RCON server");
        let address = listener.local_addr().expect("fake RCON address");

        // Use a blocking thread so this test does not depend on scheduling a
        // second async task inside the single-threaded test runtime.
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept RCON client");
            stream
                .set_read_timeout(Some(StdDuration::from_secs(2)))
                .expect("read timeout");

            let (_, kind, body) = read_blocking_packet(&mut stream);
            assert_eq!(kind, AUTH_TYPE);
            assert_eq!(body, "test-password");

            // Some Source servers send an empty RESPONSE_VALUE before the
            // actual auth result; the client must skip it.
            write_blocking_packet(&mut stream, 1, RESPONSE_TYPE, b"");
            write_blocking_packet(&mut stream, 1, AUTH_RESPONSE_TYPE, b"");

            let (_, kind, body) = read_blocking_packet(&mut stream);
            assert_eq!(kind, EXEC_TYPE);
            assert_eq!(body, "status");

            let output = "hostname: Test server\nmap: kz_test\nplayers : 0 humans, 0 bots (32/0 max) (hibernating)\n";
            write_blocking_packet(&mut stream, STATUS_ID, RESPONSE_TYPE, output.as_bytes());
        });

        let snapshot = query_status(
            "127.0.0.1",
            address.port(),
            "test-password",
            Duration::from_secs(2),
        )
        .await
        .expect("query status from fake server");

        assert_eq!(snapshot.hostname.as_deref(), Some("Test server"));
        assert_eq!(snapshot.map.as_deref(), Some("kz_test"));
        assert_eq!(snapshot.players, 0);
        assert_eq!(snapshot.max_players, Some(32));
        assert!(snapshot.hibernating);

        server.join().expect("fake RCON server task");
    }

    #[test]
    fn parses_empty_server_status() {
        let output = r"
hostname: KZ | 新手服
version : 1.38.7.3/13873 9465 secure
udp/ip  : 0.0.0.0:27015
map     : kz_bhop
players : 0 humans, 0 bots (32/0 max) (hibernating)
";
        let status = parse_status(output).expect("status");

        assert_eq!(status.hostname.as_deref(), Some("KZ | 新手服"));
        assert_eq!(status.map.as_deref(), Some("kz_bhop"));
        assert_eq!(status.players, 0);
        assert_eq!(status.max_players, Some(32));
        assert!(status.hibernating);
    }

    #[test]
    fn parses_populated_server_without_hibernation() {
        let output = r"
hostname: KZ #1
map     : kz_test
players : 3 humans, 1 bots (20/0 max) (not hibernating)
";
        let status = parse_status(output).expect("status");
        assert_eq!(status.players, 3);
        assert_eq!(status.max_players, Some(20));
        assert!(!status.hibernating);
    }

    #[test]
    fn rejects_unrelated_console_output() {
        assert!(parse_status("Unknown command: status\n").is_none());
        assert!(parse_status("").is_none());
    }

    #[test]
    fn max_players_parser_requires_the_parenthesized_field() {
        assert_eq!(parse_max_players("0 humans, 0 bots (32/0 max)"), Some(32));
        assert_eq!(parse_max_players("0 humans, 0 bots"), None);
        assert_eq!(parse_max_players("(broken max)"), None);
    }
}
