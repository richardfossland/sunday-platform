import { describe, expect, it, vi } from "vitest";

import { backoffMs, buildQuery, CloudTransport, isRetryable, SundayCloudError } from "../src/index.js";

/** A minimal mock `fetch` that returns a JSON `Response` for one queued reply. */
function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("isRetryable", () => {
  it("retries 429 and 5xx, not 4xx (except 429) or 2xx", () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(404)).toBe(false);
    expect(isRetryable(200)).toBe(false);
  });
});

describe("backoffMs", () => {
  it("honors a positive Retry-After (seconds → ms)", () => {
    expect(backoffMs(0, 3)).toBe(3000);
  });

  it("ignores a non-positive or missing Retry-After and uses exponential backoff", () => {
    expect(backoffMs(0, null)).toBe(250);
    expect(backoffMs(1, undefined)).toBe(500);
    expect(backoffMs(2, 0)).toBe(1000);
  });

  it("caps exponential backoff at 2000ms", () => {
    expect(backoffMs(10, null)).toBe(2000);
  });
});

describe("buildQuery", () => {
  it("skips null/undefined and prefixes with ? only when non-empty", () => {
    expect(buildQuery({ a: 1, b: null, c: undefined, d: "x" })).toBe("?a=1&d=x");
    expect(buildQuery({ a: null, b: undefined })).toBe("");
    expect(buildQuery({ flag: false })).toBe("?flag=false");
  });
});

describe("CloudTransport", () => {
  it("shapes the request: base URL join, JSON content type, bearer auth", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { ok: true }));
    const t = new CloudTransport({ baseUrl: "https://api.example.com/", apiKey: "k123", fetch });

    await t.postJson("/v1/usage/log", { hello: "world" });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    // trailing slash on baseUrl is stripped before joining.
    expect(url).toBe("https://api.example.com/v1/usage/log");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ hello: "world" }));
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer k123");
  });

  it("omits the Authorization header when no apiKey is set", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, {}));
    const t = new CloudTransport({ fetch });
    await t.requestJson("/health");
    const headers = fetch.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("retries on 503 then succeeds, using the injected sleep", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const sleep = vi.fn(async () => {});
    const t = new CloudTransport({ fetch, sleep });

    const out = await t.requestJson<{ ok: boolean }>("/v1/sources");

    expect(out.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("gives up after maxRetries and throws a typed SundayCloudError", async () => {
    const fetch = vi.fn(async () => jsonResponse(500, { error: "boom", message: "kaboom" }));
    const sleep = vi.fn(async () => {});
    const t = new CloudTransport({ fetch, sleep, maxRetries: 1 });

    await expect(t.requestJson("/v1/sources")).rejects.toMatchObject({
      name: "SundayCloudError",
      status: 500,
      code: "boom",
      message: "kaboom",
    });
    // 1 initial + 1 retry.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400 and surfaces the body error code", async () => {
    const fetch = vi.fn(async () => jsonResponse(400, { error: "bad_input" }));
    const t = new CloudTransport({ fetch });
    await expect(t.requestJson("/v1/songs/search")).rejects.toBeInstanceOf(SundayCloudError);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("honors a Retry-After header on a 429", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate_limited" }, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const sleep = vi.fn(async () => {});
    const t = new CloudTransport({ fetch, sleep });

    await t.requestJson("/v1/recommend");
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("falls back to status-derived error code on a non-JSON error body", async () => {
    const fetch = vi.fn(
      async () => new Response("<html>oops</html>", { status: 502, statusText: "Bad Gateway" }),
    );
    const t = new CloudTransport({ fetch, maxRetries: 0 });
    await expect(t.requestJson("/v1/sources")).rejects.toMatchObject({
      status: 502,
      code: "http_502",
      message: "Bad Gateway",
    });
  });
});
