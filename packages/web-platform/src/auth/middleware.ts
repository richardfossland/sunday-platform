import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { sharedCookieOptions } from "../supabase/cookies.js";
import type { IssuerClientConfig } from "../supabase/issuer.js";

export interface SundayMiddlewareConfig {
  /** Sunday Account issuer client config (url/anonKey/cookieDomain). */
  auth: IssuerClientConfig;
  /** Path prefix that requires a signed-in admin (default "/admin"). */
  adminPrefix?: string;
  /** Where to send unauthenticated admin visitors (default "/admin/login"). */
  loginPath?: string;
}

/**
 * Build the Sunday Account admin middleware. On the admin/auth routes it (1)
 * refreshes the issuer `sb-*` session cookie and (2) redirects unauthenticated
 * visitors of `adminPrefix` to `loginPath`, leaving `loginPath` and `/auth/*`
 * (the OAuth/magic-link callback) open. Pair it with a matcher scoped to the
 * admin + auth routes so the anonymous play surface never runs this code. If the
 * auth env is missing it passes through (route handlers still enforce requireAdmin).
 */
export function createSundayMiddleware(cfg: SundayMiddlewareConfig) {
  const adminPrefix = cfg.adminPrefix ?? "/admin";
  const loginPath = cfg.loginPath ?? "/admin/login";

  return async function middleware(request: NextRequest): Promise<NextResponse> {
    let response = NextResponse.next({ request });

    const { url, anonKey, cookieDomain } = cfg.auth;
    // If auth isn't configured (e.g. a preview without SSO env) don't break the
    // app — pass through; admin route handlers still enforce requireAdmin().
    if (!url || !anonKey) return response;

    const supabase = createServerClient(url, anonKey, {
      cookieOptions: sharedCookieOptions(cookieDomain),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;

    // `/auth/*` (the callback) and the login page are always reachable.
    const isOpen = path.startsWith("/auth") || path === loginPath;

    if (!user && path.startsWith(adminPrefix) && !isOpen) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = loginPath;
      return NextResponse.redirect(redirect);
    }
    if (user && path === loginPath) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = adminPrefix;
      return NextResponse.redirect(redirect);
    }

    return response;
  };
}
