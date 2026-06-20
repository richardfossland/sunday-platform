// Web-standard HTTP helpers for Route Handlers (no next/server dependency, so
// routes stay unit-testable in a plain runtime). Lifted verbatim from the per-app
// `lib/server/http.ts` that every Sunday web app copy-pasted — extracting it here
// means a fix/limit change ships once instead of ~11 times.

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
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "local";
}
