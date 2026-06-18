import { NextResponse, type NextRequest } from "next/server";

import { createServerAuthClient } from "./server.js";
import type { AuthClientConfig } from "./config.js";

/** Configuration for {@link callbackHandler}. */
export interface CallbackConfig extends AuthClientConfig {
  /**
   * Where to land on success when no (or an unsafe) `next` is supplied, and the
   * base for error redirects. Defaults to `/`.
   */
  defaultNext?: string;
}

/**
 * Only allow same-origin RELATIVE redirects. Rejects:
 *  - absent / empty values,
 *  - anything not starting with `/` (absolute URLs, `javascript:` …),
 *  - protocol-relative `//host` (which the browser treats as a new origin).
 *
 * Hardened version from SundayStage-web's callback. Exported so the sanitizer
 * itself is unit-testable.
 */
export function sanitizeNext(next: string | null, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/**
 * Factory returning the `GET` route handler for `/auth/callback`. This is the
 * ONLY auth-writing surface: it exchanges the `?code=` for a session (setting
 * the shared `.sundaysuite.app` auth cookie) and forwards to a sanitized
 * `next`. Mirrors SundayStage-web's hardened callback — provider errors and a
 * missing/failed exchange redirect back with an `?error=` rather than throwing.
 *
 * ```ts
 * // app/auth/callback/route.ts
 * export const dynamic = "force-dynamic";
 * export const GET = callbackHandler({
 *   url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 *   cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
 *   defaultNext: "/library",
 * });
 * ```
 */
export function callbackHandler(cfg: CallbackConfig) {
  const fallback = cfg.defaultNext ?? "/";

  return async function GET(request: NextRequest): Promise<NextResponse> {
    const { searchParams, origin } = request.nextUrl;

    const providerError =
      searchParams.get("error_code") ?? searchParams.get("error");
    if (providerError) {
      return NextResponse.redirect(
        new URL(`${fallback}?error=${encodeURIComponent(providerError)}`, origin),
      );
    }

    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(new URL(`${fallback}?error=missing_code`, origin));
    }

    const next = sanitizeNext(searchParams.get("next"), fallback);
    const supabase = await createServerAuthClient(cfg);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`${fallback}?error=exchange_failed`, origin),
      );
    }

    return NextResponse.redirect(new URL(next, origin));
  };
}
