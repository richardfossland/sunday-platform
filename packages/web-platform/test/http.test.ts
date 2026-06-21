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

  it("clientIp() prefers non-spoofable CF-Connecting-IP, falls back to XFF, else 'local'", () => {
    // CF-Connecting-IP wins even when a caller spoofs X-Forwarded-For to dodge the limit
    expect(
      clientIp(
        new Request("https://x", {
          headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.5.5.5, 1.2.3.4" },
        }),
      ),
    ).toBe("1.2.3.4");
    // no CF header → first XFF hop
    expect(
      clientIp(new Request("https://x", { headers: { "x-forwarded-for": "8.8.8.8, 9.9.9.9" } })),
    ).toBe("8.8.8.8");
    // nothing → constant
    expect(clientIp(new Request("https://x"))).toBe("local");
  });

  it("rateLimit() allows up to the limit then blocks within the window", () => {
    const key = "wp-http-test-key";
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });
});
