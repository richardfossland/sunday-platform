import type { CookieOptions } from "@supabase/ssr";

/**
 * Shared cookie options for every AUTH (Sunday Account issuer) Supabase client —
 * browser, server, middleware — so the `sb-*` session cookie is written
 * identically everywhere.
 *
 * Cross-subdomain SSO: when `cookieDomain` is set (`.sundaysuite.app` in prod),
 * the session cookie is scoped to the parent domain so every Sunday web app
 * shares one login. Leave it unset in local dev so cookies work on `localhost`.
 *
 * This applies ONLY to the issuer/auth clients. The DATA clients
 * (createDataBrowserClient / createServiceClient) stay session-less and must
 * never touch these cookies.
 */
export function sharedCookieOptions(cookieDomain?: string): CookieOptions {
  const domain = cookieDomain?.trim();
  if (!domain) return {};
  return { domain, path: "/", sameSite: "lax", secure: true };
}
