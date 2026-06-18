import { createBrowserClient } from "@supabase/ssr";

import { sharedCookieOptions } from "./cookies.js";
import type { AuthClientConfig } from "./config.js";

type BrowserAuthClient = ReturnType<typeof createBrowserClient>;

/**
 * Browser Supabase client, pointed at the AUTH project (`cfg`). Used by login
 * surfaces (magic link / Google) and any client component that reads the
 * signed-in session. Shares the cookie domain so the session spans every
 * `*.sundaysuite.app` app.
 *
 * The same cross-project caveat applies as {@link createServerAuthClient}: this
 * is the AUTH project, which may differ from the app's data project.
 */
export function createBrowserAuthClient(
  cfg: AuthClientConfig,
): BrowserAuthClient {
  return createBrowserClient(cfg.url, cfg.anonKey, {
    cookieOptions: sharedCookieOptions(cfg.cookieDomain),
  });
}
