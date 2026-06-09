//! The shared desktop session — "log into one Sunday app, all of them are
//! logged in".
//!
//! Every Tauri app on a machine reads/writes ONE file
//! (`<app-data>/SundaySuite/session.json`), so a login performed by any app is
//! seen by the rest. The file holds the rotated refresh token plus a cache of
//! the non-secret claims (`sub`, churches, grants) the local-only apps gate
//! their cloud UI on without doing any network verification.
//!
//! Design constraints (see the SSO plan):
//!   - **Atomic write-back.** Supabase rotates the refresh token on every
//!     refresh; [`write_atomic`] writes a temp file + renames so a crash mid-
//!     write can never leave a torn/empty session (which would log the user out
//!     of every app at once). On Unix the file is `0600`.
//!   - **Local-first.** A missing file = not logged in = the app runs fully
//!     offline. Auth state NEVER gates local data, only cloud features.
//!   - **Offline grace.** `claims_expires_at_ms` lets an app trust cached claims
//!     for UI while offline; [`SessionData::claims_fresh`] reports whether the
//!     cache is still within grace so the shell can prompt a reconnect (without
//!     ever locking the user out).
//!
//! Reading/writing take an explicit path so the logic is unit-testable in a temp
//! dir; [`default_path`] resolves the real per-OS location from the environment.

use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};

/// The schema version stamped into a freshly written session file. Bump on a
/// breaking layout change; [`read`] tolerates older/newer minor shapes via
/// serde defaults so a stale app doesn't choke on a file a newer app wrote.
pub const SESSION_SCHEMA_VERSION: u32 = 1;

/// The non-secret Sunday claims cached for offline UI gating. Field names match
/// the TS `SundayClaims` in `@sunday/auth-client` (camelCase) so the cache and
/// the wire contract are the same shape.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SundayClaims {
    /// Supabase user id (`sub`).
    pub sub: String,
    /// Churches the user belongs to.
    #[serde(rename = "churchIds", default)]
    pub church_ids: Vec<String>,
    /// Per-church enabled app grants, e.g. `{ "<church_id>": ["stage","rec"] }`.
    #[serde(rename = "appGrants", default)]
    pub app_grants: std::collections::BTreeMap<String, Vec<String>>,
    /// Email, when present on the token.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

impl SundayClaims {
    /// Whether the user has any access to a church (mirrors `hasChurchAccess`).
    pub fn has_church_access(&self, church_id: &str) -> bool {
        self.church_ids.iter().any(|c| c == church_id)
    }

    /// Whether the user has an enabled grant for `app` in `church_id`
    /// (mirrors `hasAppGrant`).
    pub fn has_app_grant(&self, church_id: &str, app: &str) -> bool {
        self.app_grants
            .get(church_id)
            .is_some_and(|apps| apps.iter().any(|a| a == app))
    }
}

/// The on-disk shared session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionData {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    /// The rotated Supabase refresh token (the sensitive field).
    pub refresh_token: String,
    /// Cached, non-secret claims for offline UI gating.
    #[serde(default)]
    pub cached_claims: SundayClaims,
    /// Absolute expiry (unix ms) after which cached claims should be re-verified
    /// against the issuer before any privilege-sensitive cloud action.
    pub claims_expires_at_ms: i64,
    /// The issuer alias the session was minted against (e.g.
    /// `https://auth.sundaysuite.app/auth/v1`). Lets an app notice (and discard)
    /// a session from a different/older issuer after a migration.
    pub issuer: String,
}

fn default_schema_version() -> u32 {
    SESSION_SCHEMA_VERSION
}

impl SessionData {
    /// Whether the cached claims are still within their offline-grace window.
    /// `false` once expired — the shell should refresh against the issuer before
    /// trusting them for a cloud write (but must still allow local features).
    pub fn claims_fresh(&self, now_ms: i64) -> bool {
        now_ms < self.claims_expires_at_ms
    }
}

/// Errors reading or writing the shared session.
#[derive(Debug)]
pub enum SessionError {
    /// Underlying filesystem failure.
    Io(std::io::Error),
    /// The file existed but its JSON was unreadable/malformed.
    Parse(String),
}

impl std::fmt::Display for SessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionError::Io(e) => write!(f, "session-fil I/O-feil: {e}"),
            SessionError::Parse(m) => write!(f, "session-fil uleselig: {m}"),
        }
    }
}

impl std::error::Error for SessionError {}

impl From<std::io::Error> for SessionError {
    fn from(e: std::io::Error) -> Self {
        SessionError::Io(e)
    }
}

/// Join the canonical relative path (`SundaySuite/session.json`) under `dir`.
/// Pure — every app composes the same path under its platform's data dir.
pub fn path_in(dir: &Path) -> PathBuf {
    dir.join("SundaySuite").join("session.json")
}

/// Resolve the real shared-session path from the environment, per OS:
///   - macOS:   `$HOME/Library/Application Support/SundaySuite/session.json`
///   - Windows: `%APPDATA%\SundaySuite\session.json`
///   - other:   `$XDG_DATA_HOME` or `$HOME/.local/share` + `SundaySuite/…`
///
/// Returns `None` only when the needed env var is absent (a headless/odd
/// environment) — callers treat that as "no shared session available".
pub fn default_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")?;
        Some(path_in(
            &Path::new(&home).join("Library/Application Support"),
        ))
    }
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var_os("APPDATA")?;
        Some(path_in(Path::new(&appdata)))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
            return Some(path_in(Path::new(&xdg)));
        }
        let home = std::env::var_os("HOME")?;
        Some(path_in(&Path::new(&home).join(".local/share")))
    }
}

/// Read the shared session at `path`. `Ok(None)` when the file does not exist
/// (the normal "not logged in" case); `Err` only on a real I/O failure or
/// malformed JSON.
pub fn read(path: &Path) -> Result<Option<SessionData>, SessionError> {
    match std::fs::read_to_string(path) {
        Ok(text) => {
            let data = serde_json::from_str::<SessionData>(&text)
                .map_err(|e| SessionError::Parse(e.to_string()))?;
            Ok(Some(data))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(SessionError::Io(e)),
    }
}

/// Write `data` to `path` atomically: serialize to a sibling temp file, fsync-
/// free rename over the target (rename is atomic on the same filesystem), so a
/// concurrent reader (another Sunday app) ever sees the whole old file or the
/// whole new one — never a truncated session. Creates the parent dir if needed,
/// and restricts the file to `0600` on Unix.
pub fn write_atomic(path: &Path, data: &SessionData) -> Result<(), SessionError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json =
        serde_json::to_string_pretty(data).map_err(|e| SessionError::Parse(e.to_string()))?;

    // Temp file in the SAME directory so the rename stays on one filesystem.
    let tmp = match path.file_name().and_then(|n| n.to_str()) {
        Some(name) => path.with_file_name(format!(".{name}.tmp")),
        None => return Err(SessionError::Parse("ugyldig session-sti".into())),
    };
    std::fs::write(&tmp, json.as_bytes())?;
    restrict_permissions(&tmp)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

/// Remove the shared session (local logout). Missing file is success — logging
/// out when already logged out is a no-op, not an error.
pub fn clear(path: &Path) -> Result<(), SessionError> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(SessionError::Io(e)),
    }
}

#[cfg(unix)]
fn restrict_permissions(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &Path) -> std::io::Result<()> {
    // Windows: the file lives under the per-user %APPDATA%, already isolated to
    // the OS user; there's no chmod equivalent we rely on here.
    Ok(())
}

/// Decode the Sunday claims from a JWT WITHOUT verifying its signature.
///
/// This is for caching the claims of a token THIS app just obtained over TLS
/// from the issuer — the local apps gate UI on it; real authorization is always
/// enforced server-side against a JWKS-verified token. Never use this to trust a
/// token received from an untrusted source. Returns `None` if the token isn't a
/// well-formed JWT with a base64url JSON payload.
pub fn decode_claims_unverified(jwt: &str) -> Option<SundayClaims> {
    let payload_b64 = jwt.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    let v: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    Some(extract_claims(&v))
}

/// Pull Sunday claims out of a decoded JWT payload, defensively (same coercion
/// rules as the TS `extractSundayClaims`): non-string entries are dropped, a
/// missing claim becomes empty.
fn extract_claims(v: &serde_json::Value) -> SundayClaims {
    let str_array = |val: Option<&serde_json::Value>| -> Vec<String> {
        val.and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|e| e.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default()
    };

    let mut app_grants = std::collections::BTreeMap::new();
    if let Some(obj) = v.get("app_grants").and_then(|x| x.as_object()) {
        for (church, apps) in obj {
            if let Some(arr) = apps.as_array() {
                let apps: Vec<String> = arr
                    .iter()
                    .filter_map(|e| e.as_str().map(str::to_string))
                    .collect();
                app_grants.insert(church.clone(), apps);
            }
        }
    }

    SundayClaims {
        sub: v
            .get("sub")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        church_ids: str_array(v.get("church_ids")),
        app_grants,
        email: v.get("email").and_then(|x| x.as_str()).map(str::to_string),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> SessionData {
        let mut grants = std::collections::BTreeMap::new();
        grants.insert(
            "c1".to_string(),
            vec!["stage".to_string(), "rec".to_string()],
        );
        SessionData {
            schema_version: SESSION_SCHEMA_VERSION,
            refresh_token: "RT-1".into(),
            cached_claims: SundayClaims {
                sub: "user-1".into(),
                church_ids: vec!["c1".into(), "c2".into()],
                app_grants: grants,
                email: Some("ola@kirke.no".into()),
            },
            claims_expires_at_ms: 5_000,
            issuer: "https://auth.sundaysuite.app/auth/v1".into(),
        }
    }

    #[test]
    fn read_missing_file_is_none_not_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_in(dir.path());
        assert_eq!(read(&path).unwrap(), None);
    }

    #[test]
    fn write_then_read_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_in(dir.path());
        let data = sample();
        write_atomic(&path, &data).unwrap();
        let back = read(&path).unwrap().unwrap();
        assert_eq!(back, data);
        // Parent dir + camelCase claim keys are present on disk.
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(raw.contains("\"churchIds\""));
        assert!(raw.contains("\"appGrants\""));
    }

    #[test]
    fn write_atomic_overwrites_and_leaves_no_temp() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_in(dir.path());
        write_atomic(&path, &sample()).unwrap();
        let mut updated = sample();
        updated.refresh_token = "RT-2".into(); // simulate a rotated token
        write_atomic(&path, &updated).unwrap();
        assert_eq!(read(&path).unwrap().unwrap().refresh_token, "RT-2");
        // The sibling temp file must not linger.
        let tmp = path.with_file_name(".session.json.tmp");
        assert!(!tmp.exists());
    }

    #[cfg(unix)]
    #[test]
    fn written_file_is_0600() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = path_in(dir.path());
        write_atomic(&path, &sample()).unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn clear_removes_and_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_in(dir.path());
        write_atomic(&path, &sample()).unwrap();
        clear(&path).unwrap();
        assert_eq!(read(&path).unwrap(), None);
        // Clearing an absent session is fine.
        clear(&path).unwrap();
    }

    #[test]
    fn malformed_json_is_parse_error_not_none() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_in(dir.path());
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"{not json").unwrap();
        assert!(matches!(read(&path), Err(SessionError::Parse(_))));
    }

    #[test]
    fn claims_fresh_tracks_expiry() {
        let data = sample(); // expires at 5_000
        assert!(data.claims_fresh(4_999));
        assert!(!data.claims_fresh(5_000));
        assert!(!data.claims_fresh(6_000));
    }

    #[test]
    fn claim_helpers() {
        let c = sample().cached_claims;
        assert!(c.has_church_access("c1"));
        assert!(!c.has_church_access("nope"));
        assert!(c.has_app_grant("c1", "stage"));
        assert!(!c.has_app_grant("c1", "plan"));
        assert!(!c.has_app_grant("c2", "stage"));
    }

    #[test]
    fn decode_claims_unverified_extracts_map_shaped_grants() {
        // payload: {"sub":"u","church_ids":["c1"],"app_grants":{"c1":["stage","rec"]},"email":"a@b.no"}
        let payload = r#"{"sub":"u","church_ids":["c1",5],"app_grants":{"c1":["stage","rec"],"c2":"nope"},"email":"a@b.no"}"#;
        let b64 = URL_SAFE_NO_PAD.encode(payload.as_bytes());
        let jwt = format!("header.{b64}.signature");
        let claims = decode_claims_unverified(&jwt).unwrap();
        assert_eq!(claims.sub, "u");
        // Non-string church id 5 is dropped.
        assert_eq!(claims.church_ids, vec!["c1".to_string()]);
        // Map-shaped grants survive; the malformed "c2":"nope" entry is skipped.
        assert_eq!(
            claims.app_grants.get("c1").unwrap(),
            &vec!["stage".to_string(), "rec".to_string()]
        );
        assert!(!claims.app_grants.contains_key("c2"));
        assert_eq!(claims.email.as_deref(), Some("a@b.no"));
    }

    #[test]
    fn decode_claims_unverified_rejects_garbage() {
        assert!(decode_claims_unverified("not-a-jwt").is_none());
        assert!(decode_claims_unverified("a.!!!notbase64!!!.c").is_none());
    }
}
