import { createIssuerServerClient, type IssuerClientConfig } from "../supabase/issuer.js";
import { type AdminUser, AuthError, isAdminEmail } from "./policy.js";

export interface RequireAdminConfig {
  /** Sunday Account issuer client config (url/anonKey/cookieDomain). */
  auth: IssuerClientConfig;
  /** Normalized admin allowlist (see parseAdminEmails). */
  adminEmails: string[];
}

/**
 * Resolve the signed-in admin from the Sunday Account session cookie. Throws 401
 * when there is no session, 403 when the signed-in user is not on the allowlist.
 * Identity comes from the issuer client; authorization is the allowlist — NEVER
 * taken from a request body.
 */
export async function requireAdmin(cfg: RequireAdminConfig): Promise<AdminUser> {
  const supabase = await createIssuerServerClient(cfg.auth);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError(401, "ikke_innlogget");
  const email = user.email ?? null;
  if (!isAdminEmail(email, cfg.adminEmails)) throw new AuthError(403, "ikke_admin");
  return { id: user.id, email: email! };
}

/** The current signed-in admin if there is one, else null (never throws). Used
 *  to stamp ownership without ever rejecting anonymous play. */
export async function getOptionalAdmin(
  cfg: RequireAdminConfig,
): Promise<AdminUser | null> {
  try {
    return await requireAdmin(cfg);
  } catch {
    return null;
  }
}
