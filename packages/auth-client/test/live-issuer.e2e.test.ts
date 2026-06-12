import { describe, expect, it } from "vitest";

import {
  sundayJwks,
  supabaseJwksUrl,
  verifySundayToken,
} from "../src/index.js";

/**
 * Live end-to-end check against the REAL Sunday issuer (network!): verifies an
 * actual GoTrue-minted access token through the production JWKS, proving the
 * algorithm pin, audience pin, issuer pin, and the 0010 custom_access_token_hook
 * claims all line up on the deployed project.
 *
 * Skipped unless the caller supplies a fresh token:
 *   SUNDAY_E2E_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUNDAY_E2E_TOKEN=<access_token> vitest run test/live-issuer.e2e.test.ts
 */
const url = process.env.SUNDAY_E2E_SUPABASE_URL;
const token = process.env.SUNDAY_E2E_TOKEN;

describe.skipIf(!url || !token)("live issuer e2e", () => {
  it("verifies a real access token via the production JWKS", async () => {
    const jwks = sundayJwks(supabaseJwksUrl(url!));
    const claims = await verifySundayToken(token!, jwks, {
      issuer: `${url!.replace(/\/$/, "")}/auth/v1`,
    });
    expect(claims.sub).not.toBe("");
    // The 0010 hook must have stamped the Sunday claims (arrays/maps exist
    // even for a user with no church memberships).
    expect(Array.isArray(claims.churchIds)).toBe(true);
    expect(typeof claims.appGrants).toBe("object");
  });
});
