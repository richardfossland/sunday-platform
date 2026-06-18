/**
 * Auth failure carrying an HTTP status + a stable machine code. Thrown by the
 * guards ({@link requireUser} / {@link requireAppAccess}) and turned into a JSON
 * Response by {@link authFail} in API routes. Extracted from SundayInfo's
 * `lib/server/auth.ts`.
 */
export class AuthError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Uniform catch → Response for API route handlers. Returns a JSON error Response
 * for an {@link AuthError}, or `null` for anything else (so the caller can
 * rethrow / fall through to its own 500 handling).
 *
 * ```ts
 * try {
 *   const user = await requireUser(supabase);
 *   // ...
 * } catch (err) {
 *   const res = authFail(err);
 *   if (res) return res;
 *   throw err;
 * }
 * ```
 */
export function authFail(err: unknown): Response | null {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}
