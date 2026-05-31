//! OS-native secret store (macOS Keychain / Windows Credential Manager) via the
//! `keyring` crate — NEVER plaintext. Promoted from SundayRec's `secrets/mod.rs`
//! so every Sunday app reaches for credentials through one seam with one
//! resolution precedence.
//!
//! `service` namespaces the entries (use the app's bundle id, e.g.
//! `"no.sundayrec.app"`); `account` is the per-credential slot. The Sunday-ID
//! refresh token lives under [`SUNDAY_ACCOUNT_REFRESH`] so one Sunday account
//! signs into the whole suite.

use keyring::Entry;

/// Keychain account for the Sunday-ID OAuth refresh token.
pub const SUNDAY_ACCOUNT_REFRESH: &str = "auth.sunday_refresh_token";

/// A keychain error (the backend was unreachable or refused the operation).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecretError(pub String);

impl std::fmt::Display for SecretError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "keychain: {}", self.0)
    }
}

impl std::error::Error for SecretError {}

/// A handle to one app's keychain namespace.
#[derive(Debug, Clone)]
pub struct SecretStore {
    service: String,
}

impl SecretStore {
    /// Create a store namespaced to `service` (the app's bundle id).
    pub fn new(service: impl Into<String>) -> Self {
        Self {
            service: service.into(),
        }
    }

    fn entry(&self, account: &str) -> Result<Entry, SecretError> {
        Entry::new(&self.service, account).map_err(|e| SecretError(e.to_string()))
    }

    /// Store (or replace) a credential.
    pub fn set(&self, account: &str, value: &str) -> Result<(), SecretError> {
        self.entry(account)?
            .set_password(value)
            .map_err(|e| SecretError(e.to_string()))
    }

    /// Read a credential, or `None` if unset / unreadable.
    pub fn get(&self, account: &str) -> Option<String> {
        self.entry(account).ok()?.get_password().ok()
    }

    /// Whether a credential is currently stored.
    pub fn has(&self, account: &str) -> bool {
        self.get(account).is_some()
    }

    /// Delete a credential. A missing entry is success, not an error.
    pub fn delete(&self, account: &str) -> Result<(), SecretError> {
        match self.entry(account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(SecretError(e.to_string())),
        }
    }

    /// Resolve a credential from, in order: an explicit override, the keychain,
    /// then an environment variable (for CI / power users).
    pub fn resolve(&self, explicit: Option<String>, account: &str, env_var: &str) -> String {
        resolve_from(explicit, self.get(account), std::env::var(env_var).ok())
    }
}

/// The pure precedence: explicit → keychain → env → empty. Blank/whitespace
/// values count as unset so an empty override doesn't mask a real secret.
pub fn resolve_from(
    explicit: Option<String>,
    keychain: Option<String>,
    env: Option<String>,
) -> String {
    [explicit, keychain, env]
        .into_iter()
        .flatten()
        .find(|v| !v.trim().is_empty())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn precedence_explicit_then_keychain_then_env() {
        assert_eq!(
            resolve_from(Some("x".into()), Some("k".into()), Some("e".into())),
            "x"
        );
        assert_eq!(resolve_from(None, Some("k".into()), Some("e".into())), "k");
        assert_eq!(resolve_from(None, None, Some("e".into())), "e");
        assert_eq!(resolve_from(None, None, None), "");
    }

    #[test]
    fn blank_values_fall_through() {
        assert_eq!(
            resolve_from(Some("   ".into()), Some("k".into()), None),
            "k"
        );
        assert_eq!(resolve_from(Some("".into()), None, Some("  ".into())), "");
    }

    // Exercises a REAL keychain when one is fully reachable, else skips so the
    // gate stays green in headless/sandboxed CI (where `set` may report success
    // but the entry isn't readable back). Uses a sentinel account it cleans up.
    #[test]
    fn real_keychain_round_trip_or_skip() {
        let store = SecretStore::new("dev.sunday.auth-test");
        let account = "test.sentinel";
        let sentinel = "sunday-auth-test-sentinel";
        match store.set(account, sentinel) {
            Ok(()) => match store.get(account) {
                Some(v) if v == sentinel => {
                    assert!(store.has(account));
                    store.delete(account).expect("delete");
                    assert!(!store.has(account));
                }
                _ => {
                    // Keychain accepted the write but won't read it back here —
                    // an unreliable backend, not a logic error. Clean up + skip.
                    let _ = store.delete(account);
                    eprintln!("SKIP: keychain set succeeded but read-back unavailable");
                }
            },
            Err(e) => eprintln!("SKIP: no reachable keychain: {e}"),
        }
    }
}
