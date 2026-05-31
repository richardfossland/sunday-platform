//! `sunday-auth` — Sunday ID auth primitives shared by the Tauri desktop apps.
//!
//! The deterministic, testable half of "one Sunday account signs into the whole
//! suite": PKCE (RFC 7636), OAuth loopback-callback parsing with `state`
//! validation, and an OS-keychain secret store. The impure remainder lives in
//! each app's shell — the loopback `TcpListener`, opening the system browser,
//! the `reqwest` token exchange/refresh, and the provider-specific (Supabase
//! GoTrue) authorize-URL shaping — which feeds facts into these functions and
//! acts on what they return. So this crate stays unit-testable without a
//! network, a browser, or a secret store.
//!
//! Typical desktop login:
//! 1. `let verifier = pkce::generate_code_verifier()?;`
//! 2. open the browser at the authorize URL with
//!    `code_challenge = pkce::code_challenge_s256(&verifier)` and a random `state`;
//! 3. on the loopback redirect, `callback::parse_oauth_callback(req, &state)?`;
//! 4. exchange the code (+ verifier) for tokens over the network (shell);
//! 5. `SecretStore::new(bundle_id).set(SUNDAY_ACCOUNT_REFRESH, &refresh_token)?`.

pub mod callback;
pub mod pkce;
pub mod secret;

pub use callback::{parse_oauth_callback, CallbackError, OAuthCallback};
pub use pkce::{code_challenge_s256, code_verifier_from_bytes, generate_code_verifier};
pub use secret::{resolve_from, SecretError, SecretStore, SUNDAY_ACCOUNT_REFRESH};
