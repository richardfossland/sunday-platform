// Sunday Account admin authorization policy — the ONE place the rule lives, kept
// pure (no Next/Supabase imports) so it's trivially testable and has exactly one
// thing to audit. Anonymous, code-gated play is unaffected by any of this.

export class AuthError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}

export interface AdminUser {
  id: string;
  email: string;
}

/** Parse a comma/whitespace-separated allowlist env string (e.g.
 *  `TURNERING_ADMIN_EMAILS`) into a normalized, lowercased list. */
export function parseAdminEmails(env: string | null | undefined): string[] {
  return (env ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True if `email` is on the allowlist (case-insensitive). An admin is any
 *  signed-in Sunday Account whose email is listed. */
export function isAdminEmail(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

/** Uniform catch → Response for API routes. Returns null for non-auth errors so
 *  the caller can rethrow / log them. */
export function authFail(err: unknown): Response | null {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}
