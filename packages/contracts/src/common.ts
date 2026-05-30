import { z } from "zod";

/**
 * Current Sunday wire-contract version. Every cross-app payload carries this in
 * a `schema_version` field. Bump ONLY on a breaking change, and pair it with a
 * deprecation cycle — desktop apps update rarely while the web deploys daily, so
 * an old SundayStage must keep talking to a new SundaySong. Consumers must
 * ignore unknown fields (forward-compatible).
 */
export const SCHEMA_VERSION = 1 as const;

/** A `schema_version` field that defaults to the current version when omitted. */
export const schemaVersionField = z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION);

/** The apps that make up the Sunday suite. */
export const SundayApp = z.enum([
  "sundayrec",
  "sundaystage",
  "sundayplan",
  "sundaysong",
  "sundayedit",
  "sundaystudio",
  "sundaypaper",
]);
export type SundayApp = z.infer<typeof SundayApp>;

/**
 * The URL scheme each app registers for inbound deep links (Sunday Bridge,
 * local desktop↔desktop handoff). SundayPlan/SundaySong are primarily web but
 * keep a scheme reserved for their future desktop shells.
 */
export const APP_SCHEME: Record<SundayApp, string> = {
  sundayrec: "sundayrec",
  sundaystage: "sundaystage",
  sundayplan: "sundayplan",
  sundaysong: "sundaysong",
  sundayedit: "sundayedit",
  sundaystudio: "sundaystudio",
  sundaypaper: "sundaypaper",
};

/**
 * The Supabase Realtime channel a live service broadcasts on. Stage publishes
 * cue/now-playing events here; Rec (and any other listener) subscribes. The
 * `church_id` prefix lets channel authorization be scoped per tenant.
 */
export function liveChannel(churchId: string, serviceId: string): string {
  return `church:${churchId}:service:${serviceId}`;
}

/** Raised when a contract payload or deep-link URL fails to parse. */
export class SundayContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SundayContractError";
  }
}
