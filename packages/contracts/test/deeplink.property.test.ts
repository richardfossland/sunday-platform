import { describe, expect, it } from "vitest";

import {
  buildHandoffUrl,
  decodeComponent,
  encodeComponent,
  makeUsageIdempotencyKey,
  type MediaHandoff,
  parseHandoffUrl,
} from "../src/index.js";

/**
 * Property / invariant fuzz for the deep-link codec and the cross-app
 * idempotency-key formula. These complement the fixed golden vectors in
 * `deeplink.test.ts` (which exercise a handful of literal URLs) by hammering the
 * codec with a fixed-seed pseudo-random stream of adversarial strings —
 * reserved URL bytes (`& = ? # % +`), whitespace, control chars, multibyte
 * UTF-8, emoji — that the literal vectors never cover.
 *
 * Determinism: a seeded mulberry32 PRNG. No network, no wall-clock — the same
 * inputs every run, so a failure shrinks to a reproducible minimal case.
 */

// ── deterministic PRNG ────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A pool of adversarial codepoints: ASCII reserved/url-significant chars,
// whitespace, controls, latin-1, CJK, and astral-plane emoji.
const POOL: string[] = [
  "a",
  "Z",
  "9",
  "-",
  "_",
  ".",
  "~", // unreserved (must pass through unescaped)
  " ",
  "&",
  "=",
  "?",
  "#",
  "%",
  "+",
  "/",
  ":",
  "\\",
  '"',
  "'",
  "<",
  ">",
  "{",
  "}",
  "[",
  "]",
  "|",
  "@",
  "\t",
  "\n",
  "\r",
  "\x00",
  "\x1f",
  "æ",
  "ø",
  "å",
  "é",
  "ü",
  "ß",
  "中",
  "文",
  "字",
  "🎵",
  "🙏",
  "𝕊",
];

function randStr(rng: () => number, minLen: number, maxLen: number, exclude: Set<string>): string {
  const len = minLen + Math.floor(rng() * (maxLen - minLen + 1));
  let out = "";
  for (let i = 0; i < len; i++) {
    let ch = POOL[Math.floor(rng() * POOL.length)]!;
    while (exclude.has(ch)) ch = POOL[Math.floor(rng() * POOL.length)]!;
    out += ch;
  }
  return out;
}

const ITERS = 500;

describe("codec: decodeComponent(encodeComponent(x)) === x (round-trip)", () => {
  it("survives adversarial unicode for 500 seeded inputs", () => {
    const rng = mulberry32(0xc0ffee);
    for (let i = 0; i < ITERS; i++) {
      const s = randStr(rng, 0, 24, new Set());
      const round = decodeComponent(encodeComponent(s));
      expect(round, `iter ${i}: input ${JSON.stringify(s)}`).toBe(s);
    }
  });

  it("encodeComponent only ever emits URL-safe chars", () => {
    const rng = mulberry32(0x1234abcd);
    const safe = /^[A-Za-z0-9._~%-]*$/;
    for (let i = 0; i < ITERS; i++) {
      const s = randStr(rng, 0, 24, new Set());
      const enc = encodeComponent(s);
      expect(safe.test(enc), `iter ${i}: ${JSON.stringify(s)} -> ${enc}`).toBe(true);
      // spaces never become "+"
      if (s.includes(" ")) expect(enc.includes("+")).toBe(false);
    }
  });
});

// ── handoff build → parse identity ────────────────────────────────────────────

// Values are generated in CANONICAL form (already trimmed, non-empty, glossary
// pre-deduped case-insensitively with no commas) because parse normalizes via
// trim/dedup — so identity only holds for canonical inputs, which is the
// contract's guarantee for anything `build` itself emits.
function canonicalValue(rng: () => number): string {
  // exclude all whitespace so trim() is a no-op; that is the only normalization
  // parse applies to scalar fields.
  const ws = new Set([" ", "\t", "\n", "\r"]);
  let s = randStr(rng, 1, 16, ws);
  // guard: ensure non-empty after the (no-op) trim
  if (s.trim().length === 0) s = "x";
  return s;
}

function canonicalGlossary(rng: () => number): string[] {
  const ws = new Set([" ", "\t", "\n", "\r", ","]);
  const count = Math.floor(rng() * 5);
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let term = randStr(rng, 1, 8, ws);
    if (term.trim().length === 0) term = `t${i}`;
    const lower = term.toLowerCase();
    if (seen.has(lower)) continue; // keep case-insensitively unique
    seen.add(lower);
    out.push(term);
  }
  return out;
}

function randHandoff(rng: () => number): MediaHandoff {
  const opt = (gen: () => string): string | null => (rng() < 0.5 ? gen() : null);
  return {
    action: "import",
    path: canonicalValue(rng),
    media_kind: rng() < 0.33 ? "video" : rng() < 0.5 ? "audio" : null,
    language: opt(() => canonicalValue(rng)),
    context: opt(() => canonicalValue(rng)),
    glossary: canonicalGlossary(rng),
    service_id: opt(() => canonicalValue(rng)),
    church_id: opt(() => canonicalValue(rng)),
    return_to: opt(() => canonicalValue(rng)),
  };
}

describe("deeplink: parseHandoffUrl(buildHandoffUrl(scheme, h)) === h", () => {
  it("round-trips 500 seeded canonical handoffs", () => {
    const rng = mulberry32(0xbada55);
    for (let i = 0; i < ITERS; i++) {
      const h = randHandoff(rng);
      const url = buildHandoffUrl("sundayedit", h);
      const back = parseHandoffUrl(url, "sundayedit");
      expect(back, `iter ${i}: handoff ${JSON.stringify(h)} url ${url}`).toEqual(h);
    }
  });
});

// ── idempotency-key cross-language parity oracle ──────────────────────────────

/**
 * The key formula is `svc-{serviceId}:item-{serviceItemId}` and MUST be
 * byte-identical in TS and Rust (the API dedupes on it). This table is the
 * shared oracle: the Rust test `usage_key_parity` asserts the same (input ->
 * expected) pairs, so the two languages provably agree on edge inputs (empty,
 * colons, the `:item-` separator appearing inside an id, unicode).
 */
export const IDEMPOTENCY_VECTORS: Array<[string, string, string]> = [
  ["svc-9", "1", "svc-svc-9:item-1"],
  ["", "", "svc-:item-"],
  ["a:b", "c:d", "svc-a:b:item-c:d"],
  ["x", ":item-y", "svc-x:item-:item-y"],
  ["æøå", "中文", "svc-æøå:item-中文"],
  ["33333333-3333-3333-3333-333333333333", "0", "svc-33333333-3333-3333-3333-333333333333:item-0"],
];

describe("idempotency key parity oracle", () => {
  it("matches the shared TS/Rust vector table exactly", () => {
    for (const [svc, item, expected] of IDEMPOTENCY_VECTORS) {
      expect(makeUsageIdempotencyKey(svc, item)).toBe(expected);
    }
  });
});
