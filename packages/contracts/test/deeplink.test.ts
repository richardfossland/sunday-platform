import { describe, expect, it } from "vitest";

import {
  buildHandoffUrl,
  decodeComponent,
  encodeComponent,
  MediaHandoff,
  parseHandoffUrl,
  resultCallbackUrl,
  SundayContractError,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

interface UrlCase {
  name: string;
  url: string;
  expected_scheme: string;
  payload: MediaHandoff;
}

describe("deep-link URL grammar (shared vectors)", () => {
  const cases = loadFixture<UrlCase[]>("deeplink_urls.json");
  for (const c of cases) {
    it(`parses: ${c.name}`, () => {
      const parsed = parseHandoffUrl(c.url, c.expected_scheme);
      expect(parsed).toEqual(c.payload);
    });
  }
});

describe("media_handoff fixture", () => {
  it("validates the structured payload", () => {
    const raw = loadFixture("media_handoff.json");
    expect(MediaHandoff.parse(raw)).toEqual(raw);
  });
});

describe("parse/build round-trip", () => {
  it("build → parse preserves the payload", () => {
    const h = loadFixture<MediaHandoff>("media_handoff.json");
    const url = buildHandoffUrl("sundayedit", h);
    expect(parseHandoffUrl(url, "sundayedit")).toEqual(h);
  });
});

describe("rejections", () => {
  it("wrong scheme", () => {
    expect(() => parseHandoffUrl("https://import?path=/a.mp4", "sundayedit")).toThrow(
      SundayContractError,
    );
    expect(() => parseHandoffUrl("sundayrec://import?path=/a.mp4", "sundayedit")).toThrow();
  });
  it("wrong action", () => {
    expect(() => parseHandoffUrl("sundayedit://export?path=/a.mp4", "sundayedit")).toThrow();
  });
  it("missing path", () => {
    expect(() => parseHandoffUrl("sundayedit://import?language=no", "sundayedit")).toThrow();
    expect(() => parseHandoffUrl("sundayedit://import?path=%20%20", "sundayedit")).toThrow();
  });
});

describe("tolerances", () => {
  it("trailing slash after action", () => {
    expect(parseHandoffUrl("sundayedit://import/?path=/a.mp4", "sundayedit").path).toBe("/a.mp4");
  });
  it("lone percent stays intact", () => {
    expect(parseHandoffUrl("sundayedit://import?path=/a%b/c.mp4", "sundayedit").path).toBe(
      "/a%b/c.mp4",
    );
  });
  it("unknown keys ignored", () => {
    expect(parseHandoffUrl("sundayedit://import?path=/a.mp4&futureFlag=1", "sundayedit").path).toBe(
      "/a.mp4",
    );
  });
});

describe("component codec", () => {
  it("round-trips and uses %20 for spaces", () => {
    for (const s of ["/Users/ola/My Talk (2026).srt", "C:\\Users\\Ola\\tale.vtt", "kerygma + søndag/æøå", ""]) {
      expect(decodeComponent(encodeComponent(s))).toBe(s);
    }
    expect(encodeComponent("a b")).toBe("a%20b");
  });
});

describe("result callback", () => {
  it("builds a clean callback URL", () => {
    expect(resultCallbackUrl("sundayrec", "/Users/ola/a b.srt")).toBe(
      "sundayrec://result?path=%2FUsers%2Fola%2Fa%20b.srt",
    );
  });
  it("rejects bad schemes", () => {
    expect(() => resultCallbackUrl("", "/a.srt")).toThrow();
    expect(() => resultCallbackUrl("1bad", "/a.srt")).toThrow();
    expect(() => resultCallbackUrl("a/b", "/a.srt")).toThrow();
  });
});
