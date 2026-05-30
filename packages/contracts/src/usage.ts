import { z } from "zod";

import { schemaVersionField } from "./common.js";

/**
 * "A song was displayed during a service." The canonical cross-app usage event,
 * emitted by SundayStage (or Plan) and recorded by SundaySong as the source of
 * truth for CCLI + TONO reporting. Mirrors SundaySong's `UsageLogInputSchema`
 * (`/v1/usage/log`); the API dedupes on `idempotency_key`.
 *
 * `was_streamed` is the critical bit: streamed performances feed a different
 * royalty pool than in-room ones.
 */
export const UsageEvent = z.object({
  schema_version: schemaVersionField,
  church_id: z.string().uuid(),
  song_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable(),
  /** ISO calendar date YYYY-MM-DD. */
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_displayed_sec: z.number().int().min(0).nullable(),
  was_streamed: z.boolean(),
  idempotency_key: z.string().min(8).max(120),
});
export type UsageEvent = z.infer<typeof UsageEvent>;

/**
 * Build a deterministic idempotency key for a usage event so a re-sent event
 * (network retry, app restart) never double-counts. Stable for a given service
 * item.
 */
export function makeUsageIdempotencyKey(serviceId: string, serviceItemId: string): string {
  return `svc-${serviceId}:item-${serviceItemId}`;
}
