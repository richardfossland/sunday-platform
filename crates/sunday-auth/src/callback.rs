//! Parse the OAuth redirect a loopback listener receives.
//!
//! The desktop login opens the system browser at the provider's authorize URL
//! with `redirect_uri = http://127.0.0.1:<port>/callback`; the provider then
//! redirects back with `?code=…&state=…` (or `?error=…&error_description=…`).
//! This turns that raw query — or even the whole HTTP request line — into a
//! validated [`OAuthCallback`], checking the `state` against the one we sent
//! (CSRF defence). Pure and network-free.

/// A validated authorization-code callback.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OAuthCallback {
    pub code: String,
    pub state: String,
}

/// Why a callback was rejected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CallbackError {
    /// The provider redirected with an explicit error.
    Provider {
        error: String,
        description: Option<String>,
    },
    MissingCode,
    MissingState,
    /// `state` did not match the value we generated for this attempt.
    StateMismatch,
}

/// Parse `raw` (a full redirect URL, a bare query string, or an HTTP request
/// line) and validate `state` against `expected_state`.
pub fn parse_oauth_callback(
    raw: &str,
    expected_state: &str,
) -> Result<OAuthCallback, CallbackError> {
    // Take everything after the first '?', if present; else treat the whole
    // input as the query. Then drop anything after the first whitespace so a
    // raw "GET /callback?… HTTP/1.1" request line works too.
    let after_q = raw.split_once('?').map(|(_, q)| q).unwrap_or(raw);
    let query = after_q.split_whitespace().next().unwrap_or("");

    let mut code: Option<String> = None;
    let mut state: Option<String> = None;
    let mut error: Option<String> = None;
    let mut description: Option<String> = None;

    for pair in query.split('&').filter(|s| !s.is_empty()) {
        let (raw_key, raw_val) = pair.split_once('=').unwrap_or((pair, ""));
        let key = decode_component(raw_key);
        let value = decode_component(raw_val);
        match key.as_str() {
            "code" => code = non_empty(value),
            "state" => state = non_empty(value),
            "error" => error = non_empty(value),
            "error_description" => description = non_empty(value),
            _ => {}
        }
    }

    if let Some(error) = error {
        return Err(CallbackError::Provider { error, description });
    }
    let code = code.ok_or(CallbackError::MissingCode)?;
    let state = state.ok_or(CallbackError::MissingState)?;
    if state != expected_state {
        return Err(CallbackError::StateMismatch);
    }
    Ok(OAuthCallback { code, state })
}

fn non_empty(s: String) -> Option<String> {
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

/// Percent-decode a query component (`%XX` → byte, `+` → space, invalid escapes
/// left intact). Matches the codec used elsewhere in the suite.
fn decode_component(s: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_full_redirect_url() {
        let url = "http://127.0.0.1:53219/callback?code=abc123&state=xyz";
        let cb = parse_oauth_callback(url, "xyz").unwrap();
        assert_eq!(cb.code, "abc123");
        assert_eq!(cb.state, "xyz");
    }

    #[test]
    fn parses_a_bare_query_and_request_line() {
        assert!(parse_oauth_callback("code=a&state=s", "s").is_ok());
        let line = "GET /callback?code=a&state=s HTTP/1.1";
        assert_eq!(parse_oauth_callback(line, "s").unwrap().code, "a");
    }

    #[test]
    fn rejects_state_mismatch() {
        let err = parse_oauth_callback("code=a&state=evil", "expected").unwrap_err();
        assert_eq!(err, CallbackError::StateMismatch);
    }

    #[test]
    fn surfaces_provider_error_with_description() {
        let raw = "error=access_denied&error_description=User+declined";
        let err = parse_oauth_callback(raw, "s").unwrap_err();
        assert_eq!(
            err,
            CallbackError::Provider {
                error: "access_denied".into(),
                description: Some("User declined".into()),
            }
        );
    }

    #[test]
    fn missing_fields() {
        assert_eq!(
            parse_oauth_callback("state=s", "s").unwrap_err(),
            CallbackError::MissingCode
        );
        assert_eq!(
            parse_oauth_callback("code=a", "s").unwrap_err(),
            CallbackError::MissingState
        );
    }

    #[test]
    fn decodes_percent_escapes_and_ignores_unknown_keys() {
        let cb = parse_oauth_callback("code=a%2Fb&state=s&scope=email+profile", "s").unwrap();
        assert_eq!(cb.code, "a/b");
    }
}
