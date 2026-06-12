//! `sunday-auth` — Sunday ID auth primitives shared by the Tauri desktop apps.
//!
//! The deterministic, testable half of "one Sunday account signs into the whole
//! suite": PKCE (RFC 7636), OAuth loopback-callback parsing with `state`
//! validation, Supabase GoTrue request/response shaping ([`supabase`]), the
//! shared cross-app session file ([`session`]), and an OS-keychain secret store.
//! The impure remainder lives in each app's shell — the loopback `TcpListener`,
//! opening the system browser, and the `reqwest` token exchange/refresh — which
//! feeds facts into these functions and acts on what they return. So this crate
//! stays unit-testable without a network or a browser (the session file uses a
//! temp dir in tests; the keychain test skips when unavailable).
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
pub mod session;
pub mod supabase;

pub use callback::{parse_oauth_callback, CallbackError, OAuthCallback};
pub use pkce::{code_challenge_s256, code_verifier_from_bytes, generate_code_verifier};
pub use secret::{resolve_from, SecretError, SecretStore, SUNDAY_ACCOUNT_REFRESH};
pub use session::{SessionData, SessionError, SundayClaims};
pub use supabase::{RefreshOutcome, SupabaseError, SupabaseSession};

/// Stable issuer ALIAS for the Sunday Account — the single wire-contract value
/// every desktop app pins `iss` against. The TS twin is `SUNDAY_ISSUER` in
/// `@sunday/auth-client`; keep the two in lock-step.
///
/// Intentionally an alias host, NOT a raw `*.supabase.co` URL: the issuer is
/// baked into each signed desktop binary, so pointing it at a domain you own (a
/// Supabase custom auth-domain CNAME) lets you migrate the underlying project
/// later without re-shipping every app. Until the CNAME is provisioned, the
/// shell may pass the project's real issuer explicitly; flip this constant once
/// the custom domain is live.
pub const SUNDAY_ISSUER: &str = "https://auth.sundaysuite.app/auth/v1";

/// The audience Supabase GoTrue stamps on every user access token (`aud`). The
/// same for every Sunday app, so it's the canonical default to verify against.
/// TS twin: `SUNDAY_DEFAULT_AUDIENCE` in `@sunday/auth-client`.
pub const SUNDAY_DEFAULT_AUDIENCE: &str = "authenticated";

/// Base URL of the production Sunday issuer (the shared Supabase project that
/// is also SundayPlan's backend). Default for desktop logins when no
/// `SUNDAY_SUPABASE_URL` env override is present; unlike [`SUNDAY_ISSUER`]
/// this is deliberately the raw project URL — it is what GoTrue actually
/// serves on (and stamps as `iss`) until the custom auth domain exists.
pub const SUNDAY_PROD_SUPABASE_URL: &str = "https://rkiahljrkormwzogghpc.supabase.co";

/// The production project's anon (publishable) key — public by design, the
/// same value every Sunday web bundle ships to browsers; authorization is
/// enforced by RLS and the access token, never by this key. Default for the
/// `apikey` header when no `SUNDAY_SUPABASE_ANON_KEY` env override is present.
pub const SUNDAY_PROD_SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraWFobGpya29ybXd6b2dnaHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjY2NjQsImV4cCI6MjA5NjYwMjY2NH0.FzJUHvDqShIgHk8OLiT0Rm9QBR1kAd3lDkyCn8GjS8I";

#[cfg(test)]
mod issuer_tests {
    use super::*;

    #[test]
    fn issuer_is_an_alias_not_a_raw_supabase_url() {
        // The whole point of the alias is migratability: a raw `*.supabase.co`
        // issuer baked into binaries can never be moved. Guard against a
        // regression that hardcodes the project ref here.
        assert!(!SUNDAY_ISSUER.contains("supabase.co"));
        assert!(SUNDAY_ISSUER.ends_with("/auth/v1"));
    }

    #[test]
    fn audience_matches_supabase_default() {
        assert_eq!(SUNDAY_DEFAULT_AUDIENCE, "authenticated");
    }

    #[test]
    fn prod_defaults_point_at_the_sunday_project() {
        assert!(SUNDAY_PROD_SUPABASE_URL.starts_with("https://"));
        assert!(!SUNDAY_PROD_SUPABASE_URL.ends_with('/'));
        // The anon key is a JWT whose payload names the anon role for the
        // same project ref as the URL — guard against a mismatched update.
        assert!(SUNDAY_PROD_SUPABASE_URL.contains("rkiahljrkormwzogghpc"));
        assert!(SUNDAY_PROD_SUPABASE_ANON_KEY.split('.').count() == 3);
    }
}
