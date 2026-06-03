import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BREAKPOINTS, BREAKPOINT_ORDER, mediaQuery, type Breakpoint } from "../src/index.js";

// The Tailwind v4 @theme stylesheet that must stay in sync with BREAKPOINTS.
const THEME_CSS = readFileSync(
  fileURLToPath(new URL("../src/theme.css", import.meta.url)),
  "utf8",
);

/** px value of a breakpoint as a number (strips the "px" suffix). */
function px(bp: Breakpoint): number {
  return Number.parseInt(BREAKPOINTS[bp], 10);
}

describe("BREAKPOINTS constant", () => {
  it("exposes the five mobile-first screens with the documented px values", () => {
    expect(BREAKPOINTS).toEqual({
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    });
  });

  it("names match the design intent (Tailwind-aligned sm…2xl)", () => {
    expect(Object.keys(BREAKPOINTS)).toEqual(["sm", "md", "lg", "xl", "2xl"]);
  });

  it("every value is a positive px length", () => {
    for (const bp of BREAKPOINT_ORDER) {
      expect(BREAKPOINTS[bp]).toMatch(/^\d+px$/);
      expect(px(bp)).toBeGreaterThan(0);
    }
  });

  it("ascends monotonically (mobile-first: each min-width is larger)", () => {
    const sizes = BREAKPOINT_ORDER.map((bp) => px(bp));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });

  it("BREAKPOINT_ORDER covers exactly the BREAKPOINTS keys", () => {
    expect([...BREAKPOINT_ORDER].sort()).toEqual(Object.keys(BREAKPOINTS).sort());
  });
});

describe("mediaQuery helper", () => {
  it("builds a mobile-first min-width query per breakpoint", () => {
    expect(mediaQuery("md")).toBe("(min-width: 768px)");
    expect(mediaQuery("2xl")).toBe("(min-width: 1536px)");
  });

  it("a real screen media query parses (CSS @media is valid)", () => {
    // A consuming app would emit `@media (min-width: 1024px) { … }`.
    const rule = `@media ${mediaQuery("lg")} { .x { display: grid } }`;
    expect(rule).toContain("@media (min-width: 1024px)");
  });
});

describe("theme.css @theme breakpoints", () => {
  it("declares a --breakpoint-* variable for every BREAKPOINTS entry", () => {
    for (const bp of BREAKPOINT_ORDER) {
      expect(THEME_CSS).toContain(`--breakpoint-${bp}: ${BREAKPOINTS[bp]};`);
    }
  });

  it("emits exactly the five breakpoints (no extras, so utilities can compile)", () => {
    const declared = [...THEME_CSS.matchAll(/--breakpoint-([\w-]+):\s*([^;]+);/g)].map((m) => ({
      name: m[1],
      value: m[2].trim(),
    }));
    expect(declared.map((d) => d.name).sort()).toEqual(Object.keys(BREAKPOINTS).sort());
    for (const { name, value } of declared) {
      expect(value).toBe(BREAKPOINTS[name as Breakpoint]);
    }
  });

  it("keeps the breakpoints inside the @theme block (Tailwind v4 screens)", () => {
    const themeBlock = THEME_CSS.slice(THEME_CSS.indexOf("@theme"));
    expect(themeBlock).toContain("--breakpoint-sm: 640px;");
  });
});
