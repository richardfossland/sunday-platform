import { z } from "zod";

import { schemaVersionField } from "./common.js";
import { SongRef } from "./song.js";

/**
 * Live, ephemeral signals broadcast during a running service (over Supabase
 * Realtime, on {@link liveChannel}). These are SIGNALS, not the source of truth:
 * the authoritative record (which song was shown, was_streamed) is written
 * separately as an idempotent {@link UsageEvent}. Stage publishes; Rec and any
 * other listener subscribe. `sequence` is a monotonic counter per service so a
 * late/duplicate signal can be ordered or dropped.
 */
const liveBase = {
  schema_version: schemaVersionField,
  service_id: z.string().uuid(),
  emitted_at: z.string(),
  sequence: z.number().int().min(0),
};

/** The presenter moved to a new cue/slide. */
export const CueAdvanced = z.object({
  ...liveBase,
  type: z.literal("cue.advanced"),
  item_id: z.string().nullable(),
  item_position: z.number().int().nullable(),
  label: z.string().nullable(),
  slide_index: z.number().int().nullable(),
});
export type CueAdvanced = z.infer<typeof CueAdvanced>;

/** A song became the active item — Rec can drop a chapter marker here. */
export const NowPlaying = z.object({
  ...liveBase,
  type: z.literal("now_playing"),
  song_ref: SongRef.nullable(),
  item_position: z.number().int().nullable(),
  title: z.string().nullable(),
});
export type NowPlaying = z.infer<typeof NowPlaying>;

/** The service went live (presentation started). */
export const ServiceLive = z.object({
  ...liveBase,
  type: z.literal("service.live"),
});
export type ServiceLive = z.infer<typeof ServiceLive>;

/** The service ended. */
export const ServiceEnded = z.object({
  ...liveBase,
  type: z.literal("service.ended"),
});
export type ServiceEnded = z.infer<typeof ServiceEnded>;

/** Any live signal, discriminated on `type`. */
export const LiveEvent = z.discriminatedUnion("type", [
  CueAdvanced,
  NowPlaying,
  ServiceLive,
  ServiceEnded,
]);
export type LiveEvent = z.infer<typeof LiveEvent>;
