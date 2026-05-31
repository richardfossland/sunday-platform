import { z } from "zod";

import { SCHEMA_VERSION, schemaVersionField } from "./common.js";
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

/** Fields every live-event builder needs: which service, when, and where in the
 * monotonic sequence. `sequence` is the per-service counter the caller advances
 * for each emit so listeners can order or drop late/duplicate signals. */
export interface LiveEventBase {
  serviceId: string;
  /** Monotonic per-service counter (0, 1, 2, …). */
  sequence: number;
  /** ISO 8601 UTC emit time; defaults to "now" so tests can pin it. */
  emittedAt?: string;
}

/** Build a validated {@link CueAdvanced} signal (presenter moved to a new cue). */
export function liveCueEvent(
  base: LiveEventBase,
  cue: {
    itemId?: string | null;
    itemPosition?: number | null;
    label?: string | null;
    slideIndex?: number | null;
  } = {},
): CueAdvanced {
  return CueAdvanced.parse({
    schema_version: SCHEMA_VERSION,
    type: "cue.advanced",
    service_id: base.serviceId,
    emitted_at: base.emittedAt ?? new Date().toISOString(),
    sequence: base.sequence,
    item_id: cue.itemId ?? null,
    item_position: cue.itemPosition ?? null,
    label: cue.label ?? null,
    slide_index: cue.slideIndex ?? null,
  });
}

/** Build a validated {@link NowPlaying} signal (a song became the active item). */
export function nowPlayingEvent(
  base: LiveEventBase,
  song: {
    songRef?: SongRef | null;
    itemPosition?: number | null;
    title?: string | null;
  } = {},
): NowPlaying {
  return NowPlaying.parse({
    schema_version: SCHEMA_VERSION,
    type: "now_playing",
    service_id: base.serviceId,
    emitted_at: base.emittedAt ?? new Date().toISOString(),
    sequence: base.sequence,
    song_ref: song.songRef ?? null,
    item_position: song.itemPosition ?? null,
    title: song.title ?? null,
  });
}
