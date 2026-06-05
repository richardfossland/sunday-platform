use serde::{Deserialize, Serialize};

/// Current Sunday wire-contract version. Bump ONLY on a breaking change, paired
/// with a deprecation cycle. See the crate docs.
pub const SCHEMA_VERSION: u32 = 1;

/// serde `default` for the `schema_version` field on every payload.
pub fn default_schema_version() -> u32 {
    SCHEMA_VERSION
}

/// The apps that make up the Sunday suite.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SundayApp {
    #[serde(rename = "sundayrec")]
    SundayRec,
    #[serde(rename = "sundaystage")]
    SundayStage,
    #[serde(rename = "sundayplan")]
    SundayPlan,
    #[serde(rename = "sundaysong")]
    SundaySong,
    #[serde(rename = "sundayedit")]
    SundayEdit,
    #[serde(rename = "sundaystudio")]
    SundayStudio,
    #[serde(rename = "sundaypaper")]
    SundayPaper,
}

/// The Supabase Realtime channel a live service broadcasts on. Mirrors the
/// TypeScript `liveChannel`.
pub fn live_channel(church_id: &str, service_id: &str) -> String {
    format!("church:{church_id}:service:{service_id}")
}

/// Whether a bundle/manifest `rel_path` is safe to resolve against the bundle
/// directory. A `.sundaybundle` is an UNTRUSTED import (email, USB, download), so
/// a consumer that joins `rel_path` onto the bundle dir to read/copy media must
/// first reject anything that escapes it — a Zip-Slip arbitrary file read/write.
/// Mirrors the TypeScript `isSafeRelPath`. Rejects:
///   - empty paths,
///   - embedded NUL bytes (C-string truncation tricks),
///   - absolute paths (POSIX `/…`, leading `\\`/UNC, or a Windows drive `C:\…`),
///   - any `..` path segment on either `/` or `\` separator.
///
/// Clean relative paths with subdirectories (`media/sub/x.mov`) stay valid.
pub fn is_safe_rel_path(p: &str) -> bool {
    if p.is_empty() || p.contains('\0') {
        return false;
    }
    if p.starts_with('/') || p.starts_with('\\') {
        return false;
    }
    // Windows drive letter, e.g. `C:` / `c:`.
    let bytes = p.as_bytes();
    if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        return false;
    }
    !p.split(['/', '\\']).any(|seg| seg == "..")
}

/// Raised when a deep-link URL fails to parse.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractError(pub String);

impl std::fmt::Display for ContractError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ContractError {}

#[cfg(test)]
mod tests {
    use super::is_safe_rel_path;

    #[test]
    fn rejects_traversal_absolute_and_nul_paths() {
        // Each of these escapes the bundle directory (or truncates) and must be
        // rejected — a hostile `.sundaybundle` is untrusted offline input.
        let hostile = [
            "",
            "../../../../etc/cron.d/evil",
            "media/../../../../etc/passwd",
            "/etc/passwd",
            "\\\\server\\share\\evil",
            "C:\\Windows\\System32\\evil.dll",
            "c:relative",
            "media\\..\\..\\evil",
            "media/evil\0.mov",
        ];
        for p in hostile {
            assert!(!is_safe_rel_path(p), "expected {p:?} to be rejected");
        }
    }

    #[test]
    fn accepts_clean_relative_paths() {
        for p in ["media/part1.mov", "media/sub/sermon.mov", "a.wav", "x..y/z"] {
            assert!(is_safe_rel_path(p), "expected {p:?} to be accepted");
        }
    }
}
