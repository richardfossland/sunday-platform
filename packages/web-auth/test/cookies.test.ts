import { describe, expect, it } from "vitest";

import { sharedCookieOptions } from "../src/index.js";

describe("sharedCookieOptions", () => {
  it("returns the cross-subdomain options when a domain is set", () => {
    expect(sharedCookieOptions(".sundaysuite.app")).toEqual({
      domain: ".sundaysuite.app",
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("trims whitespace around a supplied domain", () => {
    expect(sharedCookieOptions("  .sundaysuite.app  ").domain).toBe(
      ".sundaysuite.app",
    );
  });

  it("returns empty options when no domain is supplied (local dev)", () => {
    expect(sharedCookieOptions()).toEqual({});
    expect(sharedCookieOptions(undefined)).toEqual({});
  });

  it("returns empty options for a blank/whitespace domain", () => {
    expect(sharedCookieOptions("")).toEqual({});
    expect(sharedCookieOptions("   ")).toEqual({});
  });
});
