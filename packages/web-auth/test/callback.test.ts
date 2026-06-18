import { describe, expect, it } from "vitest";

import { sanitizeNext } from "../src/index.js";

describe("sanitizeNext", () => {
  it("keeps a same-origin relative path", () => {
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("/a/b?x=1#h")).toBe("/a/b?x=1#h");
  });

  it("falls back when next is absent or empty", () => {
    expect(sanitizeNext(null)).toBe("/");
    expect(sanitizeNext("")).toBe("/");
  });

  it("rejects absolute URLs (different origin)", () => {
    expect(sanitizeNext("https://evil.example/")).toBe("/");
    expect(sanitizeNext("http://evil.example")).toBe("/");
  });

  it("rejects protocol-relative //host (open redirect)", () => {
    expect(sanitizeNext("//evil.example")).toBe("/");
    expect(sanitizeNext("//evil.example/path")).toBe("/");
  });

  it("rejects values not starting with a slash", () => {
    expect(sanitizeNext("javascript:alert(1)")).toBe("/");
    expect(sanitizeNext("dashboard")).toBe("/");
  });

  it("honours a custom fallback", () => {
    expect(sanitizeNext(null, "/library")).toBe("/library");
    expect(sanitizeNext("//evil", "/library")).toBe("/library");
    expect(sanitizeNext("/safe", "/library")).toBe("/safe");
  });
});
