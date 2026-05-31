/**
 * A non-2xx response from the Sunday API surface, normalised to the suite's
 * `{ error, message }` body shape. Mirrors the error contract every `/v1/*`
 * route returns (`app.onError` / `app.notFound` in the SundaySong API), so a
 * caller can branch on `code` rather than parse strings.
 */
export class SundayCloudError extends Error {
  /** HTTP status code of the failing response. */
  readonly status: number;
  /** Machine-readable error code from the body's `error` field (or `http_<status>`). */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SundayCloudError";
    this.status = status;
    this.code = code;
  }
}
