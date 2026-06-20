import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export interface DataBrowserConfig {
  /** DATA project URL (NEXT_PUBLIC_SUPABASE_URL). */
  url: string;
  /** DATA project anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY). */
  anonKey: string;
  /**
   * Default FALSE. The DATA browser client is Realtime/presence-only; persisting
   * a session makes it write a competing `sb-*` cookie that fights the Sunday
   * Account issuer cookie. (This is the SundayTranslate fix that previously had
   * to be hand-copied app by app — here it ships once, on by default.)
   */
  persistSession?: boolean;
}

/**
 * Browser DATA client (anon key) for Realtime broadcast + presence ONLY. All
 * authoritative reads/writes go through server routes; RLS denies anon direct
 * table access.
 */
export function createDataBrowserClient(cfg: DataBrowserConfig) {
  const persist = cfg.persistSession ?? false;
  return createBrowserClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: persist,
      autoRefreshToken: persist,
      detectSessionInUrl: false,
    },
  });
}

export interface ServiceClientConfig {
  /** DATA project URL (NEXT_PUBLIC_SUPABASE_URL). */
  url: string;
  /** DATA project service-role key (SUPABASE_SERVICE_ROLE_KEY). */
  serviceRoleKey: string;
  /** The app's dedicated Postgres schema (e.g. "turnering", "quiz", "info"). */
  schema: string;
}

/**
 * Service-role DATA client — SERVER ONLY (bypasses RLS). Defaults every query +
 * RPC to the app's dedicated schema. Keep it behind an app-level `server-only`
 * re-export so it can never be bundled into client code.
 */
export function createServiceClient(cfg: ServiceClientConfig) {
  return createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: cfg.schema },
  });
}
