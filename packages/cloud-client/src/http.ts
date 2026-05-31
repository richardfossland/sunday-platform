import { SundayCloudError } from "./errors.js";

/**
 * Transport for the Sunday cloud client: request shaping (base URL join, JSON
 * headers, bearer auth) plus a retry/backoff loop on transient failures. Kept
 * separate from the typed method surface so the *shaping* is unit-testable
 * against an injected `fetch` mock — no real network is ever required, and
 * live calls remain NETWORK-UNVERIFIED.
 *
 * The retry policy mirrors the SundaySong SDK: retry on 429/5xx, honor
 * `Retry-After`, otherwise exponential backoff capped at 2s.
 */

/** Configuration for a {@link CloudTransport}. */
export interface CloudClientConfig {
  /** Where the API lives. Defaults to the SundaySong production base. */
  baseUrl?: string;
  /** Bearer API key / Sunday access token. Sent as `Authorization: Bearer …`. */
  apiKey?: string;
  /** `fetch` override for tests / non-browser runtimes. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Max retries on 429/5xx with exponential backoff. Default 2. */
  maxRetries?: number;
  /** Sleep override for tests (defaults to `setTimeout`). */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_BASE_URL = "https://api.sundaysong.com";

/** Whether a status should be retried (transient). */
export function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Compute the backoff delay (ms) before retrying `attempt` (0-based). Honors a
 * positive `Retry-After` header value (seconds); otherwise exponential
 * `250 * 2^attempt`, capped at 2000ms. Pure — unit-tested directly.
 */
export function backoffMs(attempt: number, retryAfterSeconds?: number | null): number {
  if (retryAfterSeconds != null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return Math.min(2000, 250 * 2 ** attempt);
}

/** Build a query string from a sparse param record, skipping null/undefined. */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    u.set(key, String(value));
  }
  const qs = u.toString();
  return qs ? `?${qs}` : "";
}

export class CloudTransport {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: CloudClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.apiKey = config.apiKey;
    // NETWORK-UNVERIFIED: the default global fetch performs real I/O; tests inject a mock.
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.maxRetries = config.maxRetries ?? 2;
    this.sleep = config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Headers for a request: JSON content type, bearer auth, plus any overrides. */
  private headers(extra?: HeadersInit): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...(extra ?? {}),
    };
  }

  /** Send with retry on transient failures; throw {@link SundayCloudError} on a final non-2xx. */
  async send(path: string, init?: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(this.baseUrl + path, {
        ...init,
        headers: this.headers(init?.headers),
      });
      if (res.ok) return res;
      if (isRetryable(res.status) && attempt < this.maxRetries) {
        const ra = Number(res.headers.get("retry-after"));
        await this.sleep(backoffMs(attempt, Number.isFinite(ra) ? ra : null));
        continue;
      }
      let body: { error?: string; message?: string } = {};
      try {
        body = (await res.json()) as { error?: string; message?: string };
      } catch {
        // non-JSON error body — fall through to status-derived defaults.
      }
      throw new SundayCloudError(
        res.status,
        body.error ?? `http_${res.status}`,
        body.message ?? res.statusText,
      );
    }
  }

  /** Send and parse the response body as JSON of type `T`. */
  async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    return (await (await this.send(path, init)).json()) as T;
  }

  /** Send and return the raw response body as text (e.g. CSV downloads). */
  async requestText(path: string, init?: RequestInit): Promise<string> {
    return await (await this.send(path, init)).text();
  }

  /** Helper: a JSON POST with a typed response. */
  postJson<T>(path: string, body: unknown): Promise<T> {
    return this.requestJson<T>(path, { method: "POST", body: JSON.stringify(body) });
  }
}
