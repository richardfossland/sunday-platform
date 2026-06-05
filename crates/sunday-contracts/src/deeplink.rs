//! Sunday Bridge deep links — local desktop↔desktop handoff. The generalized
//! superset of SundayEdit's `deeplink.rs`: a sister app launches the target with
//! `<scheme>://import?path=…&language=…&context=…&glossary=…&media_kind=…
//! &service_id=…&church_id=…&returnTo=…`. The grammar is identical to
//! SundayEdit's so existing `sundayedit://import` links keep parsing. Everything
//! is `application/x-www-form-urlencoded`; unknown query keys are ignored
//! (forward-compatible).

use serde::{Deserialize, Serialize};

use crate::common::ContractError;

/// The only deep-link action understood today.
pub const ACTION_IMPORT: &str = "import";

/// The kind of media being handed off.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaKind {
    Video,
    Audio,
}

/// A validated media handoff parsed from (or rendered to) an import deep link.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaHandoff {
    /// Always `"import"` today.
    pub action: String,
    /// Absolute path to the source media file. Always present.
    pub path: String,
    pub media_kind: Option<MediaKind>,
    pub language: Option<String>,
    pub context: Option<String>,
    pub glossary: Vec<String>,
    pub service_id: Option<String>,
    pub church_id: Option<String>,
    pub return_to: Option<String>,
}

/// Parse a `<expected_scheme>://import?…` URL into a [`MediaHandoff`].
pub fn parse_handoff_url(url: &str, expected_scheme: &str) -> Result<MediaHandoff, ContractError> {
    let trimmed = url.trim();

    let rest = strip_scheme(trimmed, expected_scheme)
        .ok_or_else(|| ContractError(format!("not a {expected_scheme}:// link: {url}")))?;

    let (action_part, query) = match rest.split_once('?') {
        Some((a, q)) => (a, q),
        None => (rest, ""),
    };
    let action = action_part.trim_end_matches('/').trim_start_matches('/');
    if !action.eq_ignore_ascii_case(ACTION_IMPORT) {
        return Err(ContractError(format!(
            "unsupported deep-link action: {action:?} (expected {ACTION_IMPORT:?})"
        )));
    }

    let mut path: Option<String> = None;
    let mut media_kind: Option<MediaKind> = None;
    let mut language: Option<String> = None;
    let mut context: Option<String> = None;
    let mut glossary: Vec<String> = Vec::new();
    let mut service_id: Option<String> = None;
    let mut church_id: Option<String> = None;
    let mut return_to: Option<String> = None;

    for pair in query.split('&').filter(|s| !s.is_empty()) {
        let (raw_key, raw_val) = pair.split_once('=').unwrap_or((pair, ""));
        let key = decode_component(raw_key);
        let value = decode_component(raw_val);
        match key.as_str() {
            "path" => path = non_empty(value),
            "media_kind" | "kind" => media_kind = parse_media_kind(&value),
            "language" | "lang" => language = non_empty(value),
            "context" => context = non_empty(value),
            "glossary" => glossary = split_glossary(&value),
            "service_id" => service_id = non_empty(value),
            "church_id" => church_id = non_empty(value),
            "returnTo" | "return_to" => return_to = non_empty(value),
            _ => {} // forward-compatible: ignore unknown keys
        }
    }

    let path =
        path.ok_or_else(|| ContractError("deep-link import is missing a non-empty `path`".into()))?;

    Ok(MediaHandoff {
        action: ACTION_IMPORT.to_string(),
        path,
        media_kind,
        language,
        context,
        glossary,
        service_id,
        church_id,
        return_to,
    })
}

/// Render a [`MediaHandoff`] back into a `<scheme>://import?…` URL.
pub fn build_handoff_url(scheme: &str, h: &MediaHandoff) -> String {
    let mut parts: Vec<String> = vec![format!("path={}", encode_component(&h.path))];
    if let Some(k) = h.media_kind {
        let kv = match k {
            MediaKind::Video => "video",
            MediaKind::Audio => "audio",
        };
        parts.push(format!("media_kind={kv}"));
    }
    if let Some(v) = &h.language {
        parts.push(format!("language={}", encode_component(v)));
    }
    if let Some(v) = &h.context {
        parts.push(format!("context={}", encode_component(v)));
    }
    if !h.glossary.is_empty() {
        parts.push(format!(
            "glossary={}",
            encode_component(&h.glossary.join(","))
        ));
    }
    if let Some(v) = &h.service_id {
        parts.push(format!("service_id={}", encode_component(v)));
    }
    if let Some(v) = &h.church_id {
        parts.push(format!("church_id={}", encode_component(v)));
    }
    if let Some(v) = &h.return_to {
        parts.push(format!("returnTo={}", encode_component(v)));
    }
    format!("{scheme}://{ACTION_IMPORT}?{}", parts.join("&"))
}

/// Build the hand-back URL the caller listens for once the target produces a
/// result file: `<return_to>://result?path=<encoded>`.
pub fn result_callback_url(return_to: &str, result_path: &str) -> Result<String, ContractError> {
    let scheme = return_to.trim();
    let valid = !scheme.is_empty()
        && scheme
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic())
        && scheme
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'));
    if !valid {
        return Err(ContractError(format!(
            "invalid returnTo scheme: {return_to:?}"
        )));
    }
    Ok(format!(
        "{scheme}://result?path={}",
        encode_component(result_path)
    ))
}

// ── URL component codec (matches @sunday/contracts and SundayEdit byte-for-byte) ─

/// Percent-encode a query-component value. Spaces always become `%20`, never `+`.
pub fn encode_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push('%');
                out.push(hex_digit(b >> 4));
                out.push(hex_digit(b & 0x0f));
            }
        }
    }
    out
}

fn hex_digit(n: u8) -> char {
    match n {
        0..=9 => (b'0' + n) as char,
        _ => (b'A' + (n - 10)) as char,
    }
}

/// Percent-decode one query component. `%XX` → byte, `+` → space, invalid `%`
/// escapes left as-is.
pub fn decode_component(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => match (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                (Some(hi), Some(lo)) => {
                    out.push(hi << 4 | lo);
                    i += 3;
                }
                _ => {
                    out.push(b'%');
                    i += 1;
                }
            },
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn strip_scheme<'a>(s: &'a str, scheme: &str) -> Option<&'a str> {
    let prefix_len = scheme.len() + 1;
    // The URL is untrusted (from the OS / another app): a multibyte char
    // straddling either split point must be rejected cleanly, never panic
    // `split_at` on a non-char-boundary.
    if s.len() < prefix_len
        || !s.is_char_boundary(scheme.len())
        || !s.is_char_boundary(prefix_len)
    {
        return None;
    }
    let (head, tail) = s.split_at(prefix_len);
    let (name, colon) = head.split_at(scheme.len());
    if colon != ":" || !name.eq_ignore_ascii_case(scheme) {
        return None;
    }
    Some(tail.strip_prefix("//").unwrap_or(tail))
}

fn non_empty(s: String) -> Option<String> {
    let t = s.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

fn parse_media_kind(value: &str) -> Option<MediaKind> {
    match value.trim().to_ascii_lowercase().as_str() {
        "video" => Some(MediaKind::Video),
        "audio" => Some(MediaKind::Audio),
        _ => None,
    }
}

fn split_glossary(value: &str) -> Vec<String> {
    let mut seen: Vec<String> = Vec::new();
    let mut out: Vec<String> = Vec::new();
    for term in value.split(',') {
        let t = term.trim();
        if t.is_empty() {
            continue;
        }
        let lower = t.to_lowercase();
        if seen.contains(&lower) {
            continue;
        }
        seen.push(lower);
        out.push(t.to_string());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_full_link() {
        let req = parse_handoff_url(
            "sundayedit://import?path=%2Fa.mp4&language=no&glossary=Ada+,,ada,Babbage&returnTo=sundayrec",
            "sundayedit",
        )
        .unwrap();
        assert_eq!(req.path, "/a.mp4");
        assert_eq!(req.language.as_deref(), Some("no"));
        assert_eq!(req.glossary, vec!["Ada", "Babbage"]);
        assert_eq!(req.return_to.as_deref(), Some("sundayrec"));
    }

    #[test]
    fn rejects_wrong_scheme_action_and_missing_path() {
        assert!(parse_handoff_url("https://import?path=/a.mp4", "sundayedit").is_err());
        assert!(parse_handoff_url("sundayedit://export?path=/a.mp4", "sundayedit").is_err());
        assert!(parse_handoff_url("sundayedit://import?language=no", "sundayedit").is_err());
        assert!(parse_handoff_url("sundayedit://import?path=%20%20", "sundayedit").is_err());
    }

    #[test]
    fn rejects_multibyte_prefix_without_panicking() {
        // A multi-byte UTF-8 char straddling the scheme-prefix byte boundary must
        // be rejected cleanly, never panic `split_at` on a non-char-boundary. The
        // URL comes from another app / the OS, so a malformed scheme is untrusted
        // input the parser has to survive.
        for url in [
            "æø://import?path=/a.mp4", // multibyte before the colon
            "a😀://import",            // emoji straddling prefix_len
            "中://import",             // CJK scheme head
        ] {
            assert!(
                parse_handoff_url(url, "ab").is_err(),
                "expected Err (not a panic) for {url:?}"
            );
        }
    }

    #[test]
    fn build_then_parse_round_trips() {
        let h = MediaHandoff {
            action: ACTION_IMPORT.into(),
            path: "/Users/ola/My Talk (2026).mov".into(),
            media_kind: Some(MediaKind::Video),
            language: Some("no".into()),
            context: Some("Sermon, speaker: Ola".into()),
            glossary: vec!["Ola".into(), "kerygma".into()],
            service_id: Some("svc-1".into()),
            church_id: Some("ch-1".into()),
            return_to: Some("sundayrec".into()),
        };
        let url = build_handoff_url("sundayedit", &h);
        assert_eq!(parse_handoff_url(&url, "sundayedit").unwrap(), h);
    }

    #[test]
    fn codec_round_trips_with_percent20_spaces() {
        for s in ["/Users/ola/My Talk.srt", "kerygma + søndag/æøå", ""] {
            assert_eq!(decode_component(&encode_component(s)), s);
        }
        assert_eq!(encode_component("a b"), "a%20b");
    }

    #[test]
    fn result_callback_validates_scheme() {
        assert_eq!(
            result_callback_url("sundayrec", "/a b.srt").unwrap(),
            "sundayrec://result?path=%2Fa%20b.srt"
        );
        assert!(result_callback_url("1bad", "/a").is_err());
        assert!(result_callback_url("a/b", "/a").is_err());
    }
}
