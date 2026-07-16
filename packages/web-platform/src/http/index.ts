// Web-standard HTTP helpers for Route Handlers (no next/server dependency, so
// routes stay unit-testable in a plain runtime). Lifted verbatim from the per-app
// `lib/server/http.ts` that every Sunday web app copy-pasted — extracting it here
// means a fix/limit change ships once instead of ~11 times.
//
// `timedFetch`/`timedJson` centralize a fix that previously shipped separately in
// sundaychess, sundaytranslate, and sundayquiz (an outbound call to a third-party
// API — e.g. Anthropic — with no timeout can hang a Worker invocation forever).

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status });
}

/** Parse a JSON body, returning null on malformed input. */
export async function readJson<T = Record<string, unknown>>(
  req: Request,
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

// ---------- naive in-memory rate limiter ----------
// Per-process, best-effort — good enough for a single-classroom deployment; the
// real backstop for abuse is server-side validation + DB unique constraints.
// A shared, edge-durable limiter (Cloudflare KV / Durable Object) is the planned
// F5 upgrade; this synchronous signature is kept so existing call sites are a
// pure import-path swap.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export function clientIp(req: Request): string {
  // Cloudflare sets CF-Connecting-IP to the real client IP and OVERWRITES any
  // client-supplied value, so it can't be spoofed. X-Forwarded-For, by contrast,
  // is caller-appendable — keying a per-IP rate limit on its first hop lets an
  // attacker dodge the limit by rotating a fake hop. Prefer CF-Connecting-IP;
  // fall back to the first XFF hop (other proxies / local dev), then a constant.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "local";
}

// ---------- outbound fetch with a hard timeout ----------
// Suite-wide gotcha (found first in sundaychess, then re-fixed independently in
// sundaytranslate/lib/server/translate.ts and sundayquiz/lib/server/llm.ts): an
// AbortController that is cleared as soon as `fetch()` resolves only bounds the
// connect + header phase. If the upstream then stalls mid-body — a slow/flaky
// third-party API is the common case — `await res.json()` hangs with no timeout,
// which can wedge the whole Worker invocation. The fix is ONE timer that spans
// both `fetch()` and reading the body, cleared only in a `finally` after the body
// has settled (read or aborted) — never right after `fetch()` returns.

const DEFAULT_TIMEOUT_MS = 10_000;

export interface TimedFetchOptions {
  /** Hard deadline in ms for the whole call. Default 10000. */
  timeoutMs?: number;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Run an async operation under a single AbortController-backed timer. Shared by
 * `timedFetch` (which only needs to bound `fetch()` itself) and `timedJson`
 * (which extends the same timer across the body read too) so both stay in sync
 * with exactly one timeout implementation.
 */
async function withAbortTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `fetch()` with a hard timeout: aborts the in-flight request if the server
 * doesn't respond within `timeoutMs` (default 10s). Resolves with the raw
 * `Response` as soon as headers arrive — the timeout window covers connect +
 * headers only.
 *
 * If you're going to read the body (the common case for a JSON API), prefer
 * `timedJson`: reading `res.json()`/`res.text()` yourself on a `Response`
 * returned from a *completed* `timedFetch` call is NOT covered by this
 * timeout, since the timer already cleared when `fetch()` resolved. A stalled
 * body stream would then hang forever — the exact bug this module exists to
 * prevent.
 */
export async function timedFetch(
  url: RequestInfo | URL,
  init?: RequestInit,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: TimedFetchOptions = {},
): Promise<Response> {
  return withAbortTimeout(timeoutMs, (signal) => fetch(url, { ...init, signal }));
}

/**
 * `fetch()` + parse the JSON body under ONE hard timeout (default 10s) that
 * spans BOTH the fetch call and reading the response body — see the module
 * header comment for why that matters. Returns the `Response` (so callers can
 * still check `res.ok`/`res.status`) alongside the parsed body.
 *
 * A body that is empty or not valid JSON is tolerated and yields `data: null`
 * (mirrors `readJson`'s leniency). A timeout/abort during the body read is
 * NOT tolerated the same way: it is re-thrown as the original `AbortError` so
 * it surfaces as a real timeout to the caller, instead of being masked as a
 * fake-empty success. Do not wrap this call in a `.catch()` that swallows all
 * errors indiscriminately — that reintroduces the exact masking bug this
 * helper is designed to prevent.
 */
export async function timedJson<T = unknown>(
  url: RequestInfo | URL,
  init?: RequestInit,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: TimedFetchOptions = {},
): Promise<{ res: Response; data: T | null }> {
  return withAbortTimeout(timeoutMs, async (signal) => {
    const res = await fetch(url, { ...init, signal });
    // The body read is still covered by `signal`/the same timer: aborting
    // cancels an in-flight res.json() too. Tolerate a genuinely empty/
    // non-JSON body (-> null), but let an AbortError through unchanged.
    const data = (await res.json().catch((err) => {
      if (isAbortError(err)) throw err;
      return null;
    })) as T | null;
    return { res, data };
  });
}
