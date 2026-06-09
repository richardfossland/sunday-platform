//! Supabase GoTrue PKCE flow shaping — pure, network-free decisions.
//!
//! The Sunday-Account half of the loopback login. Mirrors the proven Google
//! flow in SundayRec's `cloud/oauth.rs`, but targets Supabase GoTrue and its
//! JSON token endpoint instead of Google's form-encoded one:
//!
//!   - build the authorize URL the system browser is opened at
//!     ([`authorize_url`]),
//!   - resolve the token endpoint for a grant ([`token_endpoint`]),
//!   - build the PKCE code-exchange / refresh request bodies (JSON —
//!     [`build_pkce_exchange_body`], [`build_refresh_body`]),
//!   - turn a token-endpoint JSON body into a [`SupabaseSession`] with an
//!     absolute `expires_at_ms` ([`parse_session`]),
//!   - classify a refresh failure so the caller knows when the refresh token is
//!     dead and a re-login is required ([`classify_refresh_error`]).
//!
//! The impure half lives in each app's Tauri shell: generating the random
//! verifier + state (`pkce`), opening the browser, running the loopback
//! `TcpListener`, attaching the `apikey` (anon) header, and POSTing the bodies
//! built here. The callback itself is validated by [`crate::parse_oauth_callback`].
//!
//! ## CSRF / state
//! GoTrue's `/authorize` does not reliably echo an arbitrary `state` param, but
//! it DOES preserve the query string of `redirect_to`. So the shell builds
//! `redirect_to = http://127.0.0.1:<port>/?state=<state>` and GoTrue appends
//! `&code=…`; the loopback callback then carries both, and
//! [`crate::parse_oauth_callback`] validates the `state` exactly as for Google.
//! The PKCE `code_verifier` is the primary defence regardless (the code can't be
//! exchanged without it).

use serde_json::json;

/// A Supabase session returned by the token endpoint (PKCE exchange or refresh).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SupabaseSession {
    /// The short-lived JWT (verify via JWKS; carries `church_ids`/`app_grants`).
    pub access_token: String,
    /// The long-lived, ROTATED refresh token. Supabase issues a fresh one on
    /// every exchange/refresh and invalidates the old — the caller MUST persist
    /// this (atomically) or the next launch is logged out. See `session.rs`.
    pub refresh_token: String,
    /// Absolute access-token expiry (unix ms), resolved against the caller's now.
    pub expires_at_ms: i64,
}

/// Why parsing a Supabase token response failed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SupabaseError {
    /// Body was not the JSON shape we expect (missing access/refresh token, …).
    Parse(String),
}

impl std::fmt::Display for SupabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SupabaseError::Parse(m) => write!(f, "Supabase token-svar uleselig: {m}"),
        }
    }
}

impl std::error::Error for SupabaseError {}

/// Trim a trailing slash from a base URL so joins don't double up.
fn trim_base(base: &str) -> &str {
    base.strip_suffix('/').unwrap_or(base)
}

/// Build the GoTrue authorize URL for a social provider's PKCE flow. `base` is
/// the project/issuer origin (e.g. `https://auth.sundaysuite.app` or the raw
/// `*.supabase.co`), `provider` is e.g. `"google"`, `redirect_to` is the full
/// loopback URL the shell will listen on (already carrying `?state=…`), and
/// `challenge` is the base64url S256 PKCE challenge.
///
/// `redirect_to` is percent-encoded; everything else is a fixed/simple token, so
/// — like the Google twin — we keep the encoder minimal and only escape the one
/// field that contains reserved characters.
pub fn authorize_url(base: &str, provider: &str, redirect_to: &str, challenge: &str) -> String {
    format!(
        "{}/auth/v1/authorize?provider={}&redirect_to={}&code_challenge={}&code_challenge_method=s256",
        trim_base(base),
        provider,
        encode_component(redirect_to),
        challenge,
    )
}

/// The token endpoint for a grant. `grant` is `"pkce"` (code exchange) or
/// `"refresh_token"`.
pub fn token_endpoint(base: &str, grant: &str) -> String {
    format!("{}/auth/v1/token?grant_type={}", trim_base(base), grant)
}

/// Build the JSON body for the PKCE code exchange (`grant_type=pkce`). GoTrue
/// expects `{ "auth_code", "code_verifier" }`.
pub fn build_pkce_exchange_body(auth_code: &str, code_verifier: &str) -> String {
    json!({ "auth_code": auth_code, "code_verifier": code_verifier }).to_string()
}

/// Build the JSON body for a token refresh (`grant_type=refresh_token`).
pub fn build_refresh_body(refresh_token: &str) -> String {
    json!({ "refresh_token": refresh_token }).to_string()
}

/// Parse a GoTrue token response into a [`SupabaseSession`]. Prefers the
/// absolute `expires_at` (unix seconds) GoTrue returns; falls back to
/// `now_ms + expires_in*1000` when only the relative form is present. Both
/// `access_token` and `refresh_token` are required (GoTrue always returns the
/// latter on a successful exchange/refresh) — a missing one is a parse error so
/// the caller never silently persists a half-session.
pub fn parse_session(body: &str, now_ms: i64) -> Result<SupabaseSession, SupabaseError> {
    let v: serde_json::Value =
        serde_json::from_str(body).map_err(|e| SupabaseError::Parse(e.to_string()))?;

    let access_token = v
        .get("access_token")
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| SupabaseError::Parse("manglet access_token".into()))?
        .to_string();

    let refresh_token = v
        .get("refresh_token")
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| SupabaseError::Parse("manglet refresh_token".into()))?
        .to_string();

    let expires_at_ms = match v.get("expires_at").and_then(|x| x.as_i64()) {
        Some(secs) => secs * 1000,
        None => {
            let expires_in = v
                .get("expires_in")
                .and_then(|x| x.as_i64())
                .ok_or_else(|| SupabaseError::Parse("manglet expires_at/expires_in".into()))?;
            now_ms + expires_in * 1000
        }
    };

    Ok(SupabaseSession {
        access_token,
        refresh_token,
        expires_at_ms,
    })
}

/// What to do after a failed refresh. `Reauth` means the refresh token is dead
/// (revoked / rotated-away / not found) and the user must log in again; `Retry`
/// means a transient failure (network / 5xx) the caller may retry with backoff.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefreshOutcome {
    /// Refresh token is permanently invalid — force a fresh login.
    Reauth,
    /// Transient — safe to retry later.
    Retry,
}

/// Classify a failed-refresh response body. GoTrue surfaces a dead refresh token
/// across a few shapes depending on version: a legacy OAuth `error:
/// "invalid_grant"`, or a newer `error_code` / `code` of
/// `refresh_token_not_found` / `refresh_token_already_used` /
/// `refresh_token_revoked`. Any of those → [`RefreshOutcome::Reauth`]; anything
/// else (including an unparseable body) → [`RefreshOutcome::Retry`].
pub fn classify_refresh_error(body: &str) -> RefreshOutcome {
    let reauth_signals = [
        "invalid_grant",
        "refresh_token_not_found",
        "refresh_token_already_used",
        "refresh_token_revoked",
    ];
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return RefreshOutcome::Retry;
    };
    for field in ["error", "error_code", "code", "name"] {
        if let Some(s) = v.get(field).and_then(|x| x.as_str()) {
            if reauth_signals.contains(&s) {
                return RefreshOutcome::Reauth;
            }
        }
    }
    RefreshOutcome::Retry
}

/// Percent-encode a single URL query component: the unreserved set
/// `A-Z a-z 0-9 - . _ ~` passes through; everything else (including `:` `/` `?`
/// `&` `=` space) becomes `%XX` uppercase. Matches RFC 3986 component encoding —
/// stricter than the Google form encoder (which maps space to `+`), because this
/// value is a URL inside a query string, not a form field.
fn encode_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(b as char)
            }
            _ => {
                out.push('%');
                out.push(
                    char::from_digit((b >> 4) as u32, 16)
                        .unwrap()
                        .to_ascii_uppercase(),
                );
                out.push(
                    char::from_digit((b & 0xf) as u32, 16)
                        .unwrap()
                        .to_ascii_uppercase(),
                );
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorize_url_carries_provider_redirect_and_pkce() {
        let url = authorize_url(
            "https://auth.sundaysuite.app/",
            "google",
            "http://127.0.0.1:5712/?state=ABC",
            "CHAL",
        );
        // Trailing slash on base is trimmed (no `//auth`).
        assert!(url.starts_with("https://auth.sundaysuite.app/auth/v1/authorize?"));
        assert!(url.contains("provider=google"));
        assert!(url.contains("code_challenge=CHAL"));
        assert!(url.contains("code_challenge_method=s256"));
        // redirect_to (with its own ?state=) is fully percent-encoded so it
        // survives as a single opaque param.
        assert!(url.contains("redirect_to=http%3A%2F%2F127.0.0.1%3A5712%2F%3Fstate%3DABC"));
    }

    #[test]
    fn token_endpoint_for_each_grant() {
        assert_eq!(
            token_endpoint("https://proj.supabase.co", "pkce"),
            "https://proj.supabase.co/auth/v1/token?grant_type=pkce"
        );
        assert_eq!(
            token_endpoint("https://proj.supabase.co/", "refresh_token"),
            "https://proj.supabase.co/auth/v1/token?grant_type=refresh_token"
        );
    }

    #[test]
    fn pkce_exchange_body_shape() {
        let b = build_pkce_exchange_body("CODE", "VERIFIER");
        let v: serde_json::Value = serde_json::from_str(&b).unwrap();
        assert_eq!(v["auth_code"], "CODE");
        assert_eq!(v["code_verifier"], "VERIFIER");
    }

    #[test]
    fn refresh_body_shape() {
        let v: serde_json::Value = serde_json::from_str(&build_refresh_body("RT")).unwrap();
        assert_eq!(v["refresh_token"], "RT");
    }

    #[test]
    fn parse_session_prefers_absolute_expires_at() {
        let body = r#"{"access_token":"AT","refresh_token":"RT","expires_in":3600,"expires_at":1700000000}"#;
        let s = parse_session(body, 999).unwrap();
        assert_eq!(s.access_token, "AT");
        assert_eq!(s.refresh_token, "RT");
        // Uses expires_at (seconds) * 1000, NOT now+expires_in.
        assert_eq!(s.expires_at_ms, 1_700_000_000_000);
    }

    #[test]
    fn parse_session_falls_back_to_expires_in() {
        let body = r#"{"access_token":"AT","refresh_token":"RT","expires_in":3600}"#;
        let s = parse_session(body, 1_000_000).unwrap();
        assert_eq!(s.expires_at_ms, 1_000_000 + 3_600_000);
    }

    #[test]
    fn parse_session_requires_both_tokens() {
        // Missing refresh_token is an error (never persist a half-session).
        assert!(matches!(
            parse_session(r#"{"access_token":"AT","expires_in":1}"#, 0),
            Err(SupabaseError::Parse(_))
        ));
        // Missing access_token is an error.
        assert!(matches!(
            parse_session(r#"{"refresh_token":"RT","expires_in":1}"#, 0),
            Err(SupabaseError::Parse(_))
        ));
        // Empty string counts as missing.
        assert!(matches!(
            parse_session(
                r#"{"access_token":"","refresh_token":"RT","expires_in":1}"#,
                0
            ),
            Err(SupabaseError::Parse(_))
        ));
        // Not JSON at all.
        assert!(matches!(
            parse_session("503 unavailable", 0),
            Err(SupabaseError::Parse(_))
        ));
    }

    #[test]
    fn classify_refresh_error_detects_dead_token_across_shapes() {
        // Legacy OAuth shape.
        assert_eq!(
            classify_refresh_error(r#"{"error":"invalid_grant"}"#),
            RefreshOutcome::Reauth
        );
        // Newer GoTrue error_code shape.
        assert_eq!(
            classify_refresh_error(r#"{"code":400,"error_code":"refresh_token_not_found"}"#),
            RefreshOutcome::Reauth
        );
        assert_eq!(
            classify_refresh_error(r#"{"error_code":"refresh_token_already_used"}"#),
            RefreshOutcome::Reauth
        );
        // Transient / unknown → retry.
        assert_eq!(
            classify_refresh_error(r#"{"error":"temporarily_unavailable"}"#),
            RefreshOutcome::Retry
        );
        assert_eq!(
            classify_refresh_error("upstream 503"),
            RefreshOutcome::Retry
        );
    }
}
