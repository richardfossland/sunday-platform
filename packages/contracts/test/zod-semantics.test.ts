import { describe, expect, it } from "vitest";
import { z } from "zod";

import { nullableField, readBundle, safeRelPath, schemaVersionField, ServiceRef } from "../src/index.js";

/**
 * Pins the Zod behaviours the contracts rely on, so a Zod major bump cannot
 * change them silently. These assertions held identically on Zod 3.25 and 4.x.
 */
describe("zod semantics the contracts depend on", () => {
  const baseRef = {
    id: "11111111-1111-1111-1111-111111111111",
    church_id: "22222222-2222-2222-2222-222222222222",
    name: "Søndag",
    starts_at: "2026-01-04T10:00:00Z",
    state: "draft",
    was_streamed: false,
  };

  it("uuid fields stay lenient (any 8-4-4-4-12 hex, as in Zod 3), not RFC 9562-strict", () => {
    expect(ServiceRef.safeParse({ ...baseRef, id: "00000000-0000-0000-0000-000000000000" }).success).toBe(true);
    expect(ServiceRef.safeParse({ ...baseRef, id: "ffffffff-ffff-ffff-ffff-ffffffffffff" }).success).toBe(true);
    expect(ServiceRef.safeParse({ ...baseRef, id: "not-a-uuid" }).success).toBe(false);
    expect(ServiceRef.safeParse({ ...baseRef, id: "1111111111111111111111111111111111" }).success).toBe(false);
  });

  it("nullableField: omitted and null both become null, a value passes through", () => {
    const s = z.object({ a: nullableField(z.string()) });
    expect(s.parse({})).toEqual({ a: null });
    expect(s.parse({ a: null })).toEqual({ a: null });
    expect(s.parse({ a: "x" })).toEqual({ a: "x" });
    expect(s.safeParse({ a: 1 }).success).toBe(false);
  });

  it("schemaVersionField: default 1, positive int up to u32::MAX", () => {
    const s = z.object({ v: schemaVersionField });
    expect(s.parse({})).toEqual({ v: 1 });
    expect(s.parse({ v: 0xffff_ffff })).toEqual({ v: 0xffff_ffff });
    for (const bad of [0, -1, 1.5, 0x1_0000_0000, "1", null]) {
      expect(s.safeParse({ v: bad }).success).toBe(false);
    }
  });

  it("unknown fields are stripped, not rejected", () => {
    expect(ServiceRef.parse({ ...baseRef, extra: 1 })).not.toHaveProperty("extra");
  });

  it("safeRelPath keeps its custom message", () => {
    const r = safeRelPath.safeParse("../x");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("unsafe rel_path (absolute or escapes the bundle directory)");
  });

  it("readBundle error strings keep the `path: message` shape", () => {
    const out = readBundle(JSON.stringify({ media: "nope" }));
    expect(out.bundle).toBeNull();
    expect(out.errors.length).toBeGreaterThan(0);
    for (const e of out.errors) expect(e).toMatch(/^[^:]+: .+/);
  });
});
