import {
  extractSundayClaims,
  hasAppGrant,
  type SundayClaims,
} from "@sunday/auth-client";
import { decodeJwt } from "jose";

import { AuthError } from "./errors.js";

/**
 * The structural slice of a Supabase auth client the guards use. Both the
 * server and browser clients from `@supabase/ssr` satisfy this, so callers can
 * pass either without us depending on `@supabase/supabase-js` types directly.
 */
export interface AuthCapableClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown;
    }>;
    getSession(): Promise<{
      data: { session: { access_token: string } | null };
      error: unknown;
    }>;
  };
}

/** The signed-in user, as resolved from the session cookie. */
export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Resolve the signed-in user from the session cookie. Authorization is NEVER
 * taken from the request body — `getUser()` re-validates the token with the
 * auth server. Throws {@link AuthError} 401 when there is no session.
 *
 * Extracted from SundayInfo's `requireUser`, but the client is injected so the
 * package stays free of `next/headers` import side effects at this layer.
 */
export async function requireUser(client: AuthCapableClient): Promise<AuthUser> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new AuthError(401, "not_signed_in");
  return { id: user.id, email: user.email ?? null };
}

/** Case-insensitive allow-list membership test for an email. */
export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: string[],
): boolean {
  if (!email) return false;
  const needle = email.trim().toLowerCase();
  return adminEmails.some((e) => e.trim().toLowerCase() === needle);
}

/** Options for {@link requireAppAccess}. At least one path should be supplied. */
export interface AppAccessOptions {
  /**
   * Allow-list path (available NOW, before SSO grants are wired up): any user
   * whose email is on this list passes. Case-insensitive.
   */
  adminEmails?: string[];
  /**
   * Grant path (composes with `@sunday/auth-client`): pass when the access token
   * carries the suite's `church_ids` / `app_grants` claims (stamped by
   * SundayPlan's `custom_access_token_hook`). The user passes when they hold
   * `app` for `churchId`.
   */
  appGrant?: { churchId: string; app: string };
}

/**
 * Authorize the signed-in user for THIS app. Two composable paths:
 *
 *  - `adminEmails` — the allow-list that works today (`isAdminEmail`), before
 *    per-church SSO grants are switched on.
 *  - `appGrant` — the claims path: the access token's `app_grants` are read via
 *    `@sunday/auth-client`'s {@link extractSundayClaims} + {@link hasAppGrant}.
 *
 * A user passes if EITHER supplied path admits them. Throws {@link AuthError}
 * 401 if not signed in, 403 if signed in but not authorized.
 */
export async function requireAppAccess(
  client: AuthCapableClient,
  options: AppAccessOptions,
): Promise<AuthUser> {
  const user = await requireUser(client);

  // Allow-list path — works before SSO grants exist.
  if (options.adminEmails && isAdminEmail(user.email, options.adminEmails)) {
    return user;
  }

  // Grant path — read the Sunday claims off the access token and compose with
  // @sunday/auth-client. We trust the cookie-bound session here (the cookie was
  // written by exchangeCodeForSession and re-validated by requireUser/getUser),
  // so we decode rather than re-verify the JWKS signature.
  if (options.appGrant) {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session?.access_token) {
      let claims: SundayClaims | null = null;
      try {
        claims = extractSundayClaims(decodeJwt(session.access_token));
      } catch {
        claims = null;
      }
      if (
        claims &&
        hasAppGrant(claims, options.appGrant.churchId, options.appGrant.app)
      ) {
        return user;
      }
    }
  }

  throw new AuthError(403, "app_access_denied");
}
