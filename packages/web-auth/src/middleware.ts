import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { sharedCookieOptions } from "./cookies.js";
import type { AuthClientConfig } from "./config.js";

/** Route-gating rules for {@link updateSession}, parameterized per app. */
export interface SessionGateConfig extends AuthClientConfig {
  /**
   * Path prefixes reachable WITHOUT a signed-in user (display surfaces, public
   * APIs, the OAuth callback — which lands the exchange before any session
   * cookie exists). The session is still refreshed, but no redirect happens.
   */
  publicPrefixes?: string[];
  /**
   * Path prefixes that belong to the auth flow itself (e.g. `["/login"]`). An
   * UNauthenticated user is allowed here; an ALREADY-authenticated user landing
   * here is bounced to `/`.
   */
  authPrefixes?: string[];
  /** Where to send an unauthenticated user. Defaults to `/login`. */
  loginPath?: string;
}

/**
 * Refresh the session cookie on every request and gate non-public routes behind
 * auth. Extracted from SundayInfo's `lib/supabase/middleware.ts`, but the
 * prefix lists and login path are now arguments so each app supplies its own
 * surface map, and the Supabase project is the AUTH project from `cfg`.
 *
 * Call from an app's `middleware.ts`:
 *
 * ```ts
 * export async function middleware(request: NextRequest) {
 *   return updateSession(request, {
 *     url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *     anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 *     cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
 *     publicPrefixes: ["/skjerm", "/api/pair/", "/auth/callback"],
 *     authPrefixes: ["/login"],
 *   });
 * }
 * ```
 */
export async function updateSession(
  request: NextRequest,
  cfg: SessionGateConfig,
): Promise<NextResponse> {
  const authPrefixes = cfg.authPrefixes ?? ["/login"];
  const publicPrefixes = cfg.publicPrefixes ?? [];
  const loginPath = cfg.loginPath ?? "/login";

  let response = NextResponse.next({ request });

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet)
        response.cookies.set(name, value, options);
    },
  };

  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: sharedCookieOptions(cfg.cookieDomain),
    cookies: cookieMethods,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthRoute = authPrefixes.some((p) => path.startsWith(p));
  const isPublicRoute = publicPrefixes.some((p) => path.startsWith(p));

  if (isPublicRoute) return response;

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
