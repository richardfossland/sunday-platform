import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";

import { sharedCookieOptions } from "./cookies.js";
import type { AuthClientConfig } from "./config.js";

type ServerAuthClient = ReturnType<typeof createServerClient>;

/**
 * Server Supabase client bound to the request cookies, pointed at the AUTH
 * project (`cfg`, not assumed equal to the data project). Used to resolve the
 * signed-in user AND, in the OAuth callback, to write the session cookie.
 *
 * Mirrors SundayInfo's `lib/supabase/server.ts` / SundayStage-web's
 * `server-write.ts`: cookie writes are swallowed in an RSC render context (they
 * throw there) — the middleware refresh and the callback handler are the
 * surfaces that actually persist the session.
 */
export async function createServerAuthClient(
  cfg: AuthClientConfig,
): Promise<ServerAuthClient> {
  const cookieStore = await cookies();
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // no-op in an RSC render context — the middleware refreshes instead.
      }
    },
  };
  return createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: sharedCookieOptions(cfg.cookieDomain),
    cookies: cookieMethods,
  });
}
