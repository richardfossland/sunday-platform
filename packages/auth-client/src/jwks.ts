/**
 * Validate a Supabase-issued Sunday ID JWT and extract the suite's custom
 * claims. SundaySong (and any other service) verifies tokens statelessly
 * against Supabase's JWKS (asymmetric RS256) — it never holds a shared secret,
 * and it derives the caller's church scope from the token, never from the
 * request body. The `church_ids` / `app_grants` claims are stamped by
 * SundayPlan's `custom_access_token_hook` (migration 0010).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyOptions } from "jose";

/** The Sunday-specific claims carried on every access token. */
export interface SundayClaims {
  /** Supabase user id (`sub`). */
  sub: string;
  /** Churches the user belongs to (the only authorization source for scope). */
  churchIds: string[];
  /** Per-church enabled app grants, e.g. `{ "<church_id>": ["stage","rec"] }`. */
  appGrants: Record<string, string[]>;
  email?: string;
}

/** The second argument of `jwtVerify` — a key, key set, or remote JWKS getter. */
type VerifyKey = Parameters<typeof jwtVerify>[1];

/** Build a cached remote JWKS getter for a Supabase project. */
export function sundayJwks(
  jwksUrl: string,
): ReturnType<typeof createRemoteJWKSet> {
  return createRemoteJWKSet(new URL(jwksUrl));
}

/** The well-known JWKS URL for a Supabase project base URL. */
export function supabaseJwksUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;
}

/** Pull the Sunday claims out of a verified JWT payload (defensive on shape). */
export function extractSundayClaims(payload: JWTPayload): SundayClaims {
  const churchIds = Array.isArray(payload.church_ids)
    ? payload.church_ids.filter((x): x is string => typeof x === "string")
    : [];

  const appGrants: Record<string, string[]> = {};
  const rawGrants = payload.app_grants;
  if (rawGrants && typeof rawGrants === "object" && !Array.isArray(rawGrants)) {
    for (const [church, apps] of Object.entries(
      rawGrants as Record<string, unknown>,
    )) {
      if (Array.isArray(apps)) {
        appGrants[church] = apps.filter(
          (x): x is string => typeof x === "string",
        );
      }
    }
  }

  return {
    sub: typeof payload.sub === "string" ? payload.sub : "",
    churchIds,
    appGrants,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

/**
 * Verify a token's signature, expiry, and (optional) issuer/audience, then
 * return its Sunday claims. Throws (jose `JWTExpired`, `JWSSignatureVerificationFailed`,
 * …) if the token is invalid. `key` is anything `jwtVerify` accepts — a JWKS
 * from {@link sundayJwks} in production, or a public key in tests.
 */
export async function verifySundayToken(
  token: string,
  key: VerifyKey,
  options?: JWTVerifyOptions,
): Promise<SundayClaims> {
  const { payload } = await jwtVerify(token, key, options);
  return extractSundayClaims(payload);
}

/** Whether the user has any access to a church. */
export function hasChurchAccess(
  claims: SundayClaims,
  churchId: string,
): boolean {
  return claims.churchIds.includes(churchId);
}

/** Whether the user has an enabled grant for `app` within `churchId`. */
export function hasAppGrant(
  claims: SundayClaims,
  churchId: string,
  app: string,
): boolean {
  return (claims.appGrants[churchId] ?? []).includes(app);
}
