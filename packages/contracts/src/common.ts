import { z } from "zod";

/**
 * Current Sunday wire-contract version. Every cross-app payload carries this in
 * a `schema_version` field. Bump ONLY on a breaking change, and pair it with a
 * deprecation cycle — desktop apps update rarely while the web deploys daily, so
 * an old SundayStage must keep talking to a new SundaySong. Consumers must
 * ignore unknown fields (forward-compatible).
 */
export const SCHEMA_VERSION = 1 as const;

/**
 * The largest `schema_version` the contract accepts. The Rust twin stores this
 * field as a `u32`, so its ceiling is `2^32 - 1`; the TS schema caps at the SAME
 * value so the two languages agree on the boundary. Without the cap a payload
 * with `schema_version > u32::MAX` would parse in TS but fail to deserialize in
 * Rust — a split-brain at the offline import trust boundary, in the opposite
 * direction from a `z.literal` pin.
 */
export const MAX_SCHEMA_VERSION = 0xffff_ffff; // u32::MAX

/**
 * A `schema_version` field. Defaults to the current version when omitted, and —
 * critically — accepts ANY positive integer version up to {@link MAX_SCHEMA_VERSION},
 * not just the current one. This is the forward-compatibility guarantee: a payload
 * from a newer app (a higher `schema_version`) must still parse on an older TS
 * consumer, exactly as it does on the Rust side (a `u32`, same `2^32 - 1`
 * ceiling). Pinning this to `z.literal(SCHEMA_VERSION)` would split-brain the
 * offline import trust boundary — Rust would accept a future
 * `.sundaybundle`/event that TS rejects.
 */
export const schemaVersionField = z
  .number()
  .int()
  .positive()
  .max(MAX_SCHEMA_VERSION)
  .default(SCHEMA_VERSION);

/**
 * A nullable cross-app field that also tolerates an OMITTED key, coercing it to
 * `null`. This mirrors Rust serde's `Option<T>`, where a missing key
 * deserializes to `None` (and serializes back to `null`). Plain Zod `.nullable()`
 * requires the key to be physically present, which would reject a hand-written or
 * third-party manifest/bundle that omits a None field — JSON the Rust parser
 * accepts. Use this for every cross-language nullable field so both languages
 * agree that "absent" and "null" are the same thing.
 */
export function nullableField<T extends z.ZodTypeAny>(
  schema: T,
): z.ZodDefault<z.ZodOptional<z.ZodNullable<T>>> {
  return schema.nullable().optional().default(null);
}

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
