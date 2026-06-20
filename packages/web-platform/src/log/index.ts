// Minimal structured logging. One JSON line per event to console.* (ingested
// structurally by Cloudflare Workers Logs, which the apps already enable via
// `observability` in wrangler.jsonc) — replacing scattered ad-hoc console calls.
// Error capture is delegated to an optional sink (e.g. a Sentry adapter) so apps
// without a DSN pull in zero extra code.

export type LogLevel = "info" | "warn" | "error";

export interface ErrorSink {
  capture(err: unknown, ctx?: Record<string, unknown>): void;
}

export interface LoggerConfig {
  /** App name, stamped on every line (e.g. "turnering"). */
  app: string;
  /** Minimum level to emit (default "info"). */
  level?: LogLevel;
  /** Optional sink for error capture (e.g. a Sentry adapter). */
  sink?: ErrorSink;
}

export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

const ORDER: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

/** A structured logger emitting single-line JSON to console.*. */
export function createLogger(cfg: LoggerConfig): Logger {
  const min = ORDER[cfg.level ?? "info"];
  function emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>): void {
    if (ORDER[level] < min) return;
    const line = JSON.stringify({ app: cfg.app, level, msg, ...ctx });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    if (level === "error" && cfg.sink) {
      try {
        cfg.sink.capture(new Error(msg), ctx);
      } catch {
        // never let logging throw
      }
    }
  }
  return {
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
  };
}

/** Wrap a Route Handler to log method/path/status/ms and capture throws. */
export function withRequestLog(
  log: Logger,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const started = Date.now();
    const path = new URL(req.url).pathname;
    try {
      const res = await handler(req);
      log.info("request", { method: req.method, path, status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      log.error("request_error", {
        method: req.method,
        path,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}

/** Standalone error capture (no-op unless a sink is provided). */
export function captureError(
  err: unknown,
  sink: ErrorSink | undefined,
  ctx?: Record<string, unknown>,
): void {
  if (!sink) return;
  try {
    sink.capture(err, ctx);
  } catch {
    // never let capture throw
  }
}
