import { describe, expect, it } from "vitest";

import { AuthError, authFail, isAdminEmail, parseAdminEmails } from "../src/auth/policy";

describe("admin policy", () => {
  it("parseAdminEmails splits on comma/whitespace, lowercases, drops blanks", () => {
    expect(parseAdminEmails("A@x.no, b@y.no\n  c@z.no ")).toEqual(["a@x.no", "b@y.no", "c@z.no"]);
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });

  it("isAdminEmail is case-insensitive; rejects non-listed / empty / empty-allowlist", () => {
    const allow = parseAdminEmails("admin@kirke.no");
    expect(isAdminEmail("Admin@Kirke.no", allow)).toBe(true);
    expect(isAdminEmail("other@kirke.no", allow)).toBe(false);
    expect(isAdminEmail(null, allow)).toBe(false);
    expect(isAdminEmail("admin@kirke.no", [])).toBe(false);
  });

  it("authFail maps AuthError to a Response and passes other errors through", async () => {
    const res = authFail(new AuthError(403, "ikke_admin"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(await res!.json()).toEqual({ error: "ikke_admin" });
    expect(authFail(new Error("boom"))).toBeNull();
  });
});
