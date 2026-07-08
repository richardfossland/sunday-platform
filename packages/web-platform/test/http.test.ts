import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientIp, fail, ok, rateLimit, readJson, timedFetch, timedJson } from "../src/http";

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

describe("timedFetch / timedJson", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /**
   * A fetch stub that never settles on its own — it only resolves/rejects when
   * the AbortSignal passed via `init.signal` fires. This mirrors how a real
   * `fetch()` behaves when the request is aborted mid-flight, without relying
   * on real network timing under fake timers.
   */
  function hangingFetch() {
    return vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
  }

  it("timedFetch resolves with the Response when it completes before the deadline", async () => {
    const response = new Response(JSON.stringify({ a: 1 }), { status: 200 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );

    const res = await timedFetch("https://example.test", undefined, { timeoutMs: 1000 });
    expect(res).toBe(response);
    // No dangling timer left behind once the call settles.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("timedFetch aborts when the fetch call itself hangs past timeoutMs", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const pending = timedFetch("https://example.test", undefined, { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("timedJson resolves with parsed data when fetch + body both complete before the deadline", async () => {
    const response = {
      ok: true,
      status: 200,
      json: async () => ({ a: 1 }),
    } as unknown as Response;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );

    const { res, data } = await timedJson<{ a: number }>("https://example.test", undefined, {
      timeoutMs: 1000,
    });
    expect(res).toBe(response);
    expect(data).toEqual({ a: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("timedJson aborts when the body read hangs, even though fetch() itself already resolved", async () => {
    // The regression this guards: an earlier per-app pattern cleared the
    // timeout as soon as `fetch()` resolved, so a stall in the body stream
    // (headers arrived, body never finished) hung forever.
    let capturedSignal: AbortSignal | undefined;
    const response = {
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          capturedSignal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    } as unknown as Response;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return response;
      }),
    );

    const pending = timedJson("https://example.test", undefined, { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("re-throws the AbortError on timeout instead of masking it as a null/empty result", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const pending = timedJson("https://example.test", undefined, { timeoutMs: 1000 });
    // Attach both assertions before advancing the clock so the rejection is
    // never briefly unhandled.
    const isDomException = expect(pending).rejects.toBeInstanceOf(DOMException);
    const isAbortError = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1000);
    await isDomException;
    await isAbortError;
  });

  it("tolerates a malformed/empty JSON body that is NOT caused by an abort, returning null data", async () => {
    // A genuine parse failure (bad/empty body, no abort involved) must NOT be
    // conflated with a timeout — it degrades to `data: null`, matching
    // readJson()'s leniency, while a real AbortError above still propagates.
    const response = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );

    const { data } = await timedJson("https://example.test", undefined, { timeoutMs: 1000 });
    expect(data).toBeNull();
  });
});
