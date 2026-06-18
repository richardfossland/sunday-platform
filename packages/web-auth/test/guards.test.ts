import { describe, expect, it } from "vitest";
import { SignJWT, generateKeyPair } from "jose";

import {
  AuthError,
  isAdminEmail,
  requireAppAccess,
  requireUser,
  type AuthCapableClient,
} from "../src/index.js";

/** Build a fake @supabase/ssr-shaped client with a fixed user + access token. */
function fakeClient(opts: {
  user: { id: string; email?: string | null } | null;
  accessToken?: string;
}): AuthCapableClient {
  return {
    auth: {
      async getUser() {
        return { data: { user: opts.user }, error: null };
      },
      async getSession() {
        return {
          data: {
            session: opts.accessToken ? { access_token: opts.accessToken } : null,
          },
          error: null,
        };
      },
    },
  };
}

/** Mint a Sunday-shaped access token (decodeJwt never checks the signature). */
async function tokenWith(claims: Record<string, unknown>): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

describe("isAdminEmail", () => {
  it("matches case-insensitively, trimming whitespace", () => {
    const list = ["Ola@Kirke.no", "kari@kirke.no"];
    expect(isAdminEmail("ola@kirke.no", list)).toBe(true);
    expect(isAdminEmail("  KARI@KIRKE.NO ", list)).toBe(true);
    expect(isAdminEmail("nope@kirke.no", list)).toBe(false);
  });

  it("rejects empty / nullish emails", () => {
    expect(isAdminEmail(null, ["ola@kirke.no"])).toBe(false);
    expect(isAdminEmail(undefined, ["ola@kirke.no"])).toBe(false);
    expect(isAdminEmail("", ["ola@kirke.no"])).toBe(false);
  });
});

describe("requireUser", () => {
  it("returns the user when signed in", async () => {
    const client = fakeClient({ user: { id: "u1", email: "ola@kirke.no" } });
    await expect(requireUser(client)).resolves.toEqual({
      id: "u1",
      email: "ola@kirke.no",
    });
  });

  it("throws AuthError 401 when not signed in", async () => {
    const client = fakeClient({ user: null });
    await expect(requireUser(client)).rejects.toBeInstanceOf(AuthError);
    await expect(requireUser(client)).rejects.toMatchObject({
      status: 401,
      message: "not_signed_in",
    });
  });
});

describe("requireAppAccess — allow-list path", () => {
  it("admits a user whose email is on the allow-list", async () => {
    const client = fakeClient({ user: { id: "u1", email: "ola@kirke.no" } });
    await expect(
      requireAppAccess(client, { adminEmails: ["ola@kirke.no"] }),
    ).resolves.toEqual({ id: "u1", email: "ola@kirke.no" });
  });

  it("rejects (403) a signed-in user not on the allow-list", async () => {
    const client = fakeClient({ user: { id: "u1", email: "stranger@x.no" } });
    await expect(
      requireAppAccess(client, { adminEmails: ["ola@kirke.no"] }),
    ).rejects.toMatchObject({ status: 403, message: "app_access_denied" });
  });

  it("rejects (401) when not signed in at all", async () => {
    const client = fakeClient({ user: null });
    await expect(
      requireAppAccess(client, { adminEmails: ["ola@kirke.no"] }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireAppAccess — grant path (composes @sunday/auth-client)", () => {
  it("admits a user holding the app grant for the church", async () => {
    const token = await tokenWith({
      church_ids: ["c1"],
      app_grants: { c1: ["info", "stage"] },
    });
    const client = fakeClient({
      user: { id: "u1", email: "ola@kirke.no" },
      accessToken: token,
    });
    await expect(
      requireAppAccess(client, { appGrant: { churchId: "c1", app: "info" } }),
    ).resolves.toMatchObject({ id: "u1" });
  });

  it("rejects (403) when the grant is missing for that church", async () => {
    const token = await tokenWith({
      church_ids: ["c1"],
      app_grants: { c1: ["stage"] },
    });
    const client = fakeClient({
      user: { id: "u1", email: "ola@kirke.no" },
      accessToken: token,
    });
    await expect(
      requireAppAccess(client, { appGrant: { churchId: "c1", app: "info" } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allow-list and grant compose: either path admits", async () => {
    const token = await tokenWith({ church_ids: [], app_grants: {} });
    const client = fakeClient({
      user: { id: "u1", email: "ola@kirke.no" },
      accessToken: token,
    });
    // No grant, but email is allow-listed → still admitted.
    await expect(
      requireAppAccess(client, {
        adminEmails: ["ola@kirke.no"],
        appGrant: { churchId: "c1", app: "info" },
      }),
    ).resolves.toMatchObject({ id: "u1" });
  });
});
