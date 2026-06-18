import type { CookieOptions } from "@supabase/ssr";

/**
 * Shared cookie options for every Supabase client (browser, server, middleware)
 * so the session cookie is written identically everywhere.
 *
 * Cross-subdomain SSO (Sunday Account): when a `domain` is supplied
 * (`.sundaysuite.app` in production), the session cookie is scoped to the
 * parent domain so every Sunday web app shares ONE login. Leave it unset in
 * local dev so cookies keep working on `localhost`.
 *
 * Extracted from SundayInfo's `lib/supabase/cookies.ts`, but the domain is now
 * an explicit argument rather than read from `process.env` — the package never
 * assumes a particular env var name. Apps pass
 * `process.env.NEXT_PUBLIC_COOKIE_DOMAIN` (or whatever they call it) through
 * `cfg.cookieDomain`.
 */
export function sharedCookieOptions(domain?: string): CookieOptions {
  const trimmed = domain?.trim();
  if (!trimmed) return {};
  return {
    domain: trimmed,
    path: "/",
    sameSite: "lax",
    secure: true,
  };
}
