import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { sharedCookieOptions } from "./cookies.js";

export interface IssuerClientConfig {
  /** Sunday Account issuer project URL (NEXT_PUBLIC_SUNDAY_AUTH_URL). */
  url: string;
  /** Issuer anon key (NEXT_PUBLIC_SUNDAY_AUTH_ANON_KEY). */
  anonKey: string;
  /** Parent cookie domain for cross-subdomain SSO (".sundaysuite.app"). */
  cookieDomain?: string;
}

/**
 * Server AUTH client bound to the Sunday Account ISSUER project (not the app's
 * DATA project), reading the `sb-*` session cookie to resolve "who is logged in".
 * Authorization is the email allowlist (see auth/policy) — never a request body.
 * Deliberately separate from the DATA clients so the two never fight over cookies.
 */
export async function createIssuerServerClient(cfg: IssuerClientConfig) {
  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: sharedCookieOptions(cfg.cookieDomain),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Cookie writes throw in Server Components; the middleware refreshes the
        // session, so swallowing here is safe.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // no-op in RSC render context
        }
      },
    },
  });
}

/**
 * Browser AUTH client for the issuer project — used on the login page to start a
 * magic-link / OAuth flow. The session cookie it owns is the `.sundaysuite.app`
 * `sb-*` cookie (scoped by the server/middleware via sharedCookieOptions).
 */
export function createIssuerBrowserClient(cfg: IssuerClientConfig) {
  return createBrowserClient(cfg.url, cfg.anonKey);
}
