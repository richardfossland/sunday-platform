import { describe, expect, it } from "vitest";

import { clientIp, fail, ok, rateLimit, readJson } from "../src/http";

describe("http helpers", () => {
  it("ok() returns JSON 200 by default", async () => {
    const res = ok({ a: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ a: 1 });
  });

  it("fail() sets status + error + extras", async () => {
    const res = fail(429, "for_mange", { retryAfter: 5 });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "for_mange", retryAfter: 5 });
  });

  it("readJson() parses valid JSON and returns null on garbage", async () => {
    const good = new Request("https://x/y", { method: "POST", body: JSON.stringify({ x: 1 }) });
    expect(await readJson(good)).toEqual({ x: 1 });
    const bad = new Request("https://x/y", { method: "POST", body: "{not json" });
    expect(await readJson(bad)).toBeNull();
  });

  it("clientIp() reads the first x-forwarded-for, else 'local'", () => {
    const r = new Request("https://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(r)).toBe("1.2.3.4");
    expect(clientIp(new Request("https://x"))).toBe("local");
  });

  it("rateLimit() allows up to the limit then blocks within the window", () => {
    const key = "wp-http-test-key";
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });
});
