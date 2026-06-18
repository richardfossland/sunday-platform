/**
 * Configuration for a Sunday web-auth client.
 *
 * CROSS-PROJECT-AWARE: these point at the AUTH project (the Supabase project
 * that issues the Sunday Account session — `auth.sundaysuite.app`), which is NOT
 * necessarily the same project that holds an app's own data. Sister apps often
 * read/write their data in their own Supabase project while authenticating
 * against the shared Sunday Account project. So the URL/anon key are passed in
 * explicitly here rather than assumed equal to the data project's.
 */
export interface AuthClientConfig {
  /** Base URL of the AUTH Supabase project, e.g. `https://xxx.supabase.co`. */
  url: string;
  /** Anon (publishable) key of the AUTH Supabase project. */
  anonKey: string;
  /**
   * Parent domain for the shared session cookie, e.g. `.sundaysuite.app`.
   * Omit in local dev so cookies work on `localhost`. When set, every Sunday
   * web app shares one login (Sunday Account SSO).
   */
  cookieDomain?: string;
}
