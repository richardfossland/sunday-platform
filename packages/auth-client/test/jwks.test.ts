import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";

import {
  extractSundayClaims,
  hasAppGrant,
  hasChurchAccess,
  supabaseJwksUrl,
  verifySundayToken,
} from "../src/index.js";

/** Sign a Sunday-shaped access token with a freshly generated RS256 key. */
async function issueToken(
  claims: Record<string, unknown>,
  opts?: { expSeconds?: number },
) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const builder = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("user-1")
    .setIssuedAt()
    .setIssuer("https://proj.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setExpirationTime(`${opts?.expSeconds ?? 3600}s`);
  return { token: await builder.sign(privateKey), publicKey };
}

describe("verifySundayToken", () => {
  it("verifies a valid token and extracts Sunday claims", async () => {
    const { token, publicKey } = await issueToken({
      church_ids: ["c1", "c2"],
      app_grants: { c1: ["stage", "rec"], c2: ["plan"] },
      email: "ola@kirke.no",
    });
    const claims = await verifySundayToken(token, publicKey, {
      issuer: "https://proj.supabase.co/auth/v1",
      audience: "authenticated",
    });
    expect(claims.sub).toBe("user-1");
    expect(claims.churchIds).toEqual(["c1", "c2"]);
    expect(claims.email).toBe("ola@kirke.no");
    expect(hasChurchAccess(claims, "c1")).toBe(true);
    expect(hasChurchAccess(claims, "nope")).toBe(false);
    expect(hasAppGrant(claims, "c1", "stage")).toBe(true);
    expect(hasAppGrant(claims, "c1", "plan")).toBe(false);
    expect(hasAppGrant(claims, "c2", "plan")).toBe(true);
  });

  it("rejects a token signed by a different key", async () => {
    const { token } = await issueToken({ church_ids: [] });
    const { publicKey: otherKey } = await generateKeyPair("RS256");
    await expect(verifySundayToken(token, otherKey)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const { token, publicKey } = await issueToken(
      { church_ids: [] },
      { expSeconds: -10 },
    );
    await expect(verifySundayToken(token, publicKey)).rejects.toThrow();
  });

  it("rejects a wrong audience", async () => {
    const { token, publicKey } = await issueToken({ church_ids: [] });
    await expect(
      verifySundayToken(token, publicKey, { audience: "service_role" }),
    ).rejects.toThrow();
  });
});

describe("extractSundayClaims", () => {
  it("defaults defensively on missing/malformed claims", () => {
    expect(extractSundayClaims({})).toEqual({
      sub: "",
      churchIds: [],
      appGrants: {},
      email: undefined,
    });
    // Non-string entries are filtered out.
    const c = extractSundayClaims({
      sub: "u",
      church_ids: ["a", 5, "b"],
      app_grants: { x: ["stage", 1], y: "nope" },
    });
    expect(c.churchIds).toEqual(["a", "b"]);
    expect(c.appGrants).toEqual({ x: ["stage"] });
  });
});

describe("supabaseJwksUrl", () => {
  it("builds the well-known JWKS URL", () => {
    expect(supabaseJwksUrl("https://proj.supabase.co")).toBe(
      "https://proj.supabase.co/auth/v1/.well-known/jwks.json",
    );
    expect(supabaseJwksUrl("https://proj.supabase.co/")).toBe(
      "https://proj.supabase.co/auth/v1/.well-known/jwks.json",
    );
  });
});
