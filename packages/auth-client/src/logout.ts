/**
 * Single logout for the web surfaces.
 *
 * `signOut({ scope: "global" })` is the AUTHORITATIVE half: GoTrue revokes ALL
 * of this user's refresh tokens server-side, so every other Sunday session —
 * another browser tab, another device, a desktop app — can no longer refresh
 * and falls back to signed-out within one access-token lifetime (≤1h, the
 * project's JWT expiry). Access tokens are stateless (verified against JWKS, not
 * a session lookup), so that window is inherent unless a revocation denylist is
 * added; for the suite's threat model the ≤1h convergence is the accepted
 * contract.
 *
 * The LOCAL half — clearing THIS client's stored session and emitting the
 * `SIGNED_OUT` event that same-origin tabs listen for via `onAuthStateChange` —
 * is performed by `signOut()` itself.
 *
 * Structurally typed against the supabase-js client so this package keeps its
 * zero-runtime-dependency stance (no `@supabase/supabase-js` import). Any object
 * exposing `auth.signOut({ scope })` satisfies it — including the real client.
 */
export interface GlobalSignOutClient {
  auth: {
    signOut(opts: {
      scope: "global" | "local" | "others";
    }): Promise<{ error: unknown | null }>;
  };
}

/**
 * Log the user out of every Sunday surface. Resolves once GoTrue has accepted
 * the global revocation; rejects (rather than silently swallowing) if the
 * server reports an error, so the caller can surface a retry to the user — the
 * authoritative step must not fail quietly. Callers that also want an instant
 * local teardown when the network is down should catch and still clear local UI.
 */
export async function logoutEverywhere(client: GlobalSignOutClient): Promise<void> {
  const { error } = await client.auth.signOut({ scope: "global" });
  if (error) {
    throw new Error(`Sunday single-logout failed: ${String(error)}`);
  }
}
