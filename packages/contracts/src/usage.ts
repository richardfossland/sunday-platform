import { z } from "zod";

import { nullableField, SCHEMA_VERSION, schemaVersionField } from "./common.js";

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
  variant_id: nullableField(z.string().uuid()),
  /** ISO calendar date YYYY-MM-DD. */
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_displayed_sec: nullableField(z.number().int().min(0)),
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

/** Inputs for {@link buildUsageEvent} — the Stage→Song usage bridge. */
export interface BuildUsageEventInput {
  churchId: string;
  songId: string;
  variantId?: string | null;
  /** ISO calendar date YYYY-MM-DD. */
  serviceDate: string;
  wasStreamed: boolean;
  durationDisplayedSec?: number | null;
  /** The service this song was shown in — feeds the idempotency key. */
  serviceId: string;
  /** The running-order item — feeds the idempotency key. */
  serviceItemId: string;
}

/**
 * Build a validated {@link UsageEvent} from a service item, deriving the dedupe
 * key with {@link makeUsageIdempotencyKey} so a retried emit never double-counts.
 * The canonical way SundayStage/Plan report a played song to SundaySong's
 * `/v1/usage/log`.
 */
export function buildUsageEvent(input: BuildUsageEventInput): UsageEvent {
  return UsageEvent.parse({
    schema_version: SCHEMA_VERSION,
    church_id: input.churchId,
    song_id: input.songId,
    variant_id: input.variantId ?? null,
    service_date: input.serviceDate,
    duration_displayed_sec: input.durationDisplayedSec ?? null,
    was_streamed: input.wasStreamed,
    idempotency_key: makeUsageIdempotencyKey(input.serviceId, input.serviceItemId),
  });
}
