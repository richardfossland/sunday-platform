import { describe, expect, it } from "vitest";

import { accentFor, ACCENTS, PALETTE, SUNDAY_APPS, type SundayApp } from "../src/index.js";

describe("accent map", () => {
  it("covers all 7 apps with exactly one accent each", () => {
    expect(SUNDAY_APPS.length).toBe(7);
    const keys = Object.keys(ACCENTS).sort();
    expect(keys).toEqual([...SUNDAY_APPS].sort());
  });

  it("accentFor returns the mapped accent for every app", () => {
    for (const app of SUNDAY_APPS) {
      expect(accentFor(app)).toBe(ACCENTS[app]);
    }
  });

  it("every accent hue is a valid 6-digit hex", () => {
    for (const app of SUNDAY_APPS) {
      const a = ACCENTS[app];
      for (const hex of [a.hex, a.hexSoft, a.hexStrong, a.onAccent]) {
        expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("matches the documented per-app brand accents", () => {
    expect(ACCENTS.sundaystudio.name).toMatch(/Gold/i);
    expect(ACCENTS.sundaypaper.name).toMatch(/Copper/i);
    // SundayEdit and SundayStudio are the dark "pro" creative tools.
    expect(ACCENTS.sundayedit.prefersDark).toBe(true);
    expect(ACCENTS.sundaystudio.prefersDark).toBe(true);
    expect(ACCENTS.sundayrec.prefersDark).toBe(false);
  });
});

describe("shared tokens", () => {
  it("exposes a neutral ramp and semantic status hues", () => {
    expect(PALETTE.neutral[500]).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(PALETTE.status.danger).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("the app union and the map agree at the type level", () => {
    // Exhaustiveness: a switch over every app must be assignable.
    const labelOf = (app: SundayApp): string => ACCENTS[app].name;
    expect(labelOf("sundayrec")).toBeTypeOf("string");
  });
});
