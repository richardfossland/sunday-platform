/**
 * @sunday/auth-client — Sunday ID auth client.
 *
 * PKCE helpers (WebCrypto, mirroring the Rust `sunday-auth` crate) for the
 * desktop/web login round-trip, plus Supabase JWT validation via JWKS with the
 * suite's custom `church_ids` / `app_grants` claims. Stateless: services verify
 * tokens against the project's public JWKS and derive scope from the token.
 */
export * from "./pkce.js";
export * from "./jwks.js";
export * from "./logout.js";
