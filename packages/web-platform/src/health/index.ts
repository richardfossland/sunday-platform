import { createServiceClient, type ServiceClientConfig } from "../supabase/data.js";

export interface HealthRouteConfig {
  /** Service-role client config (url/serviceRoleKey/schema). */
  service: ServiceClientConfig;
  /** A cheap existence probe: a HEAD count on this table in the schema. */
  probe: { table: string; schemaName: string };
  /** Extra readiness flags reported as booleans (computed lazily; the VALUES,
   *  e.g. an API key, are never leaked — only whether they're configured). */
  flags?: Record<string, () => boolean>;
  /** Optional operator hint included when Supabase is unreachable. */
  hint?: string;
}

export interface HealthRoute {
  GET: () => Promise<Response>;
}

/**
 * Build a `/api/health` Route Handler, generalizing SundayTranslate's probe:
 * confirms the service-role client can reach Supabase and that the app's schema
 * is exposed (a head-only count), and reports configured integrations as
 * booleans. 200 when healthy, 503 otherwise. Never returns secret values.
 *
 * Usage in an app's `app/api/health/route.ts`:
 *   export const dynamic = "force-dynamic";
 *   export const { GET } = createHealthRoute({ ... });
 */
export function createHealthRoute(cfg: HealthRouteConfig): HealthRoute {
  async function GET(): Promise<Response> {
    const flags: Record<string, boolean> = {};
    for (const [name, fn] of Object.entries(cfg.flags ?? {})) {
      try {
        flags[name] = fn();
      } catch {
        flags[name] = false;
      }
    }

    let supabaseOk = false;
    let schemaOk = false;
    try {
      const db = createServiceClient(cfg.service);
      const { error } = await db
        .from(cfg.probe.table)
        .select("*", { count: "exact", head: true });
      supabaseOk = true;
      schemaOk = !error;
    } catch {
      supabaseOk = false;
    }

    const body: Record<string, unknown> = {
      supabase: supabaseOk,
      [`${cfg.probe.schemaName}_schema`]: schemaOk,
      ...flags,
    };
    if (!supabaseOk && cfg.hint) body.hint = cfg.hint;

    return Response.json(body, { status: supabaseOk && schemaOk ? 200 : 503 });
  }

  return { GET };
}
