use std::{
    net::{IpAddr, SocketAddr},
    process::Stdio,
    time::Duration,
};

use tokio::{io::AsyncWriteExt, process::Command, time::timeout};
use url::form_urlencoded;

use crate::{config::AuthSettings, errors::AppError};

const STEAM_HOST: &str = "steamcommunity.com";
/// The fully-qualified form of the same name. Some networks reset TLS
/// connections based on the exact SNI string, while Steam accepts this form
/// and serves the same certificate.
const STEAM_SNI: &str = "steamcommunity.com.";
const USER_AGENT: &str = "ThRei/0.1 (+https://threi.cn)";
const OPENSSL_TIMEOUT: Duration = Duration::from_secs(12);
const MAX_RESPONSE_BYTES: usize = 1_048_576;

/// Sends an `OpenID` form to Steam. `allow_fallback` is false for
/// `check_authentication`: the assertion is single-use, so a request that may
/// have reached Steam must not be replayed through another transport.
pub async fn post_form(
    settings: &AuthSettings,
    path: &str,
    form: &[(String, String)],
) -> Result<String, AppError> {
    let body = {
        let mut serializer = form_urlencoded::Serializer::new(String::new());
        for (key, value) in form {
            serializer.append_pair(key, value);
        }
        serializer.finish()
    };
    request(settings, "POST", path, Some(body.as_bytes()), false).await
}

/// Fetches a Steam Community resource. Safe to retry through the configured
/// base URL when the direct transport fails.
pub async fn get(settings: &AuthSettings, path: &str) -> Result<String, AppError> {
    request(settings, "GET", path, None, true).await
}

async fn request(
    settings: &AuthSettings,
    method: &str,
    path: &str,
    body: Option<&[u8]>,
    allow_fallback: bool,
) -> Result<String, AppError> {
    if let Some(ip) = direct_ip(settings) {
        match openssl_request(ip, method, path, body).await {
            Ok(body) => return Ok(body),
            Err(error) if allow_fallback => {
                tracing::warn!(
                    error = %error,
                    "direct Steam request failed; retrying through the configured base URL"
                );
            }
            Err(error) => return Err(error),
        }
    }

    reqwest_request(settings, method, path, body).await
}

fn direct_ip(settings: &AuthSettings) -> Option<IpAddr> {
    if settings.steam_community_base_url == "https://steamcommunity.com" {
        settings.steam_community_ip
    } else {
        None
    }
}

async fn reqwest_request(
    settings: &AuthSettings,
    method: &str,
    path: &str,
    body: Option<&[u8]>,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| {
            AppError::internal_message(format!("failed to create Steam HTTP client: {error}"))
        })?;
    let url = format!("{}{}", settings.steam_community_base_url, path);
    let request = if method == "POST" {
        client
            .post(url)
            .header(
                reqwest::header::CONTENT_TYPE,
                "application/x-www-form-urlencoded",
            )
            .body(body.unwrap_or_default().to_vec())
    } else {
        client.get(url)
    };

    let response = request
        .send()
        .await
        .map_err(|error| AppError::internal_message(format!("Steam request failed: {error}")))?;
    let status = response.status();
    if !status.is_success() {
        return Err(AppError::bad_request(format!(
            "Steam request was rejected with HTTP {status}"
        )));
    }
    response.text().await.map_err(|error| {
        AppError::internal_message(format!("failed to read Steam response: {error}"))
    })
}

async fn openssl_request(
    ip: IpAddr,
    method: &str,
    path: &str,
    body: Option<&[u8]>,
) -> Result<String, AppError> {
    if !path.starts_with('/') || path.contains(['\r', '\n']) {
        return Err(AppError::internal_message("invalid Steam request path"));
    }
    if method != "GET" && method != "POST" {
        return Err(AppError::internal_message(
            "unsupported Steam request method",
        ));
    }

    let request = build_request(method, path, body);
    let address = SocketAddr::new(ip, 443).to_string();
    let mut command = Command::new("openssl");
    command
        .args(["s_client", "-quiet", "-connect"])
        .arg(address)
        .args([
            "-servername",
            STEAM_SNI,
            "-verify_hostname",
            STEAM_HOST,
            "-verify_return_error",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let output = timeout(OPENSSL_TIMEOUT, async {
        let mut child = command.spawn().map_err(|error| {
            AppError::internal_message(format!("failed to start openssl: {error}"))
        })?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::internal_message("openssl stdin is unavailable"))?;
        stdin.write_all(&request).await.map_err(|error| {
            AppError::internal_message(format!("failed to send Steam request: {error}"))
        })?;
        drop(stdin);
        child.wait_with_output().await.map_err(|error| {
            AppError::internal_message(format!("failed to wait for openssl: {error}"))
        })
    })
    .await
    .map_err(|_| AppError::internal_message("Steam request timed out"))??;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let detail = stderr
            .lines()
            .filter(|line| !line.starts_with("depth=") && !line.starts_with("verify return:"))
            .take(3)
            .collect::<Vec<_>>()
            .join(" | ");
        let status = output
            .status
            .code()
            .map_or_else(|| "unknown".to_owned(), |code| code.to_string());
        return Err(AppError::internal_message(format!(
            "openssl failed with status {status}: {detail}"
        )));
    }

    let response = parse_http_response(&output.stdout)?;
    if !(200..300).contains(&response.status) {
        return Err(AppError::bad_request(format!(
            "Steam request was rejected with HTTP {}",
            response.status
        )));
    }
    Ok(String::from_utf8_lossy(&response.body).into_owned())
}

fn build_request(method: &str, path: &str, body: Option<&[u8]>) -> Vec<u8> {
    let mut request = Vec::with_capacity(256 + body.map_or(0, <[u8]>::len));
    request.extend_from_slice(format!("{method} {path} HTTP/1.1\r\n").as_bytes());
    request.extend_from_slice(b"Host: steamcommunity.com\r\n");
    request.extend_from_slice(format!("User-Agent: {USER_AGENT}\r\n").as_bytes());
    request.extend_from_slice(b"Accept: */*\r\n");
    request.extend_from_slice(b"Accept-Encoding: identity\r\n");
    request.extend_from_slice(b"Connection: close\r\n");
    if let Some(body) = body {
        request.extend_from_slice(b"Content-Type: application/x-www-form-urlencoded\r\n");
        request.extend_from_slice(format!("Content-Length: {}\r\n", body.len()).as_bytes());
    }
    request.extend_from_slice(b"\r\n");
    if let Some(body) = body {
        request.extend_from_slice(body);
    }
    request
}

#[derive(Debug)]
struct HttpResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl HttpResponse {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.as_str())
    }
}

fn parse_http_response(bytes: &[u8]) -> Result<HttpResponse, AppError> {
    let (header_bytes, body) = split_headers(bytes)
        .ok_or_else(|| AppError::internal_message("Steam returned an invalid HTTP response"))?;
    let header_text = String::from_utf8_lossy(header_bytes).replace("\r\n", "\n");
    let mut lines = header_text.split('\n');
    let status_line = lines
        .next()
        .ok_or_else(|| AppError::internal_message("Steam response has no status line"))?;
    let status = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| AppError::internal_message("Steam response has an invalid status line"))?;
    let headers = lines
        .filter_map(|line| {
            let (key, value) = line.split_once(':')?;
            Some((key.trim().to_ascii_lowercase(), value.trim().to_owned()))
        })
        .collect::<Vec<_>>();
    let mut response = HttpResponse {
        status,
        headers,
        body: body.to_vec(),
    };

    if let Some(encoding) = response.header("content-encoding").map(str::to_owned)
        && !encoding.eq_ignore_ascii_case("identity")
    {
        return Err(AppError::internal_message(format!(
            "unsupported Steam response encoding: {encoding}"
        )));
    }

    let transfer_encoding = response.header("transfer-encoding").map(str::to_owned);
    let content_length = response.header("content-length").map(str::to_owned);
    if transfer_encoding.is_some_and(|value| value.to_ascii_lowercase().contains("chunked")) {
        response.body = decode_chunked(&response.body)?;
    } else if let Some(length) = content_length.and_then(|value| value.parse::<usize>().ok()) {
        if response.body.len() < length {
            return Err(AppError::internal_message(
                "Steam response body is shorter than Content-Length",
            ));
        }
        response.body.truncate(length);
    }

    if response.body.len() > MAX_RESPONSE_BYTES {
        return Err(AppError::internal_message("Steam response is too large"));
    }
    Ok(response)
}

fn split_headers(bytes: &[u8]) -> Option<(&[u8], &[u8])> {
    if let Some(index) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
        return Some((&bytes[..index], &bytes[index + 4..]));
    }
    bytes
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (&bytes[..index], &bytes[index + 2..]))
}

fn decode_chunked(mut data: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut body = Vec::new();
    loop {
        let line_end = data
            .windows(2)
            .position(|window| window == b"\r\n")
            .ok_or_else(|| AppError::internal_message("Steam sent invalid chunked encoding"))?;
        let size_line = std::str::from_utf8(&data[..line_end])
            .map_err(|_| AppError::internal_message("Steam sent invalid chunked encoding"))?;
        let size_text = size_line.split(';').next().unwrap_or_default().trim();
        let size = usize::from_str_radix(size_text, 16)
            .map_err(|_| AppError::internal_message("Steam sent an invalid chunk size"))?;
        data = &data[line_end + 2..];
        if size == 0 {
            return Ok(body);
        }
        if data.len() < size + 2 {
            return Err(AppError::internal_message(
                "Steam sent a truncated chunked response",
            ));
        }
        body.extend_from_slice(&data[..size]);
        data = &data[size + 2..];
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_send<T: Send>(_: T) {}

    #[test]
    fn transport_futures_are_send() {
        let settings = AuthSettings {
            web_url: "https://example.com".to_owned(),
            steam_return_url: "https://example.com/api/v1/auth/steam/callback".to_owned(),
            steam_realm: "https://example.com".to_owned(),
            steam_community_base_url: "https://steamcommunity.com".to_owned(),
            steam_community_ip: Some("23.15.140.216".parse().expect("valid IP")),
            cookie_secure: true,
            session_ttl_days: 30,
            admin_steam_ids: Vec::new(),
            steam_skip_openid_verification: false,
        };
        assert_send(post_form(&settings, "/openid/login", &[]));
        assert_send(get(&settings, "/profiles/76561199125125759?xml=1"));
    }

    #[test]
    fn parses_content_length_response() {
        let raw =
            b"HTTP/1.1 200 OK\r\nContent-Length: 10\r\nContent-Type: text/plain\r\n\r\nis_valid:0";
        let response = parse_http_response(raw).expect("valid response");

        assert_eq!(response.status, 200);
        assert_eq!(response.body, b"is_valid:0");
    }

    #[test]
    fn decodes_chunked_response() {
        let raw = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n";
        let response = parse_http_response(raw).expect("valid chunked response");

        assert_eq!(response.body, b"hello world");
    }

    #[test]
    fn rejects_missing_header_separator() {
        assert!(parse_http_response(b"not an HTTP response").is_err());
    }

    #[test]
    fn builds_expected_request() {
        let request = build_request("POST", "/openid/login", Some(b"a=b"));
        let text = String::from_utf8(request).expect("ASCII request");

        assert!(text.starts_with("POST /openid/login HTTP/1.1\r\n"));
        assert!(text.contains("Host: steamcommunity.com\r\n"));
        assert!(text.ends_with("\r\n\r\na=b"));
    }
}
