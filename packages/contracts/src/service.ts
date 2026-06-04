import { z } from "zod";

import { nullableField, schemaVersionField } from "./common.js";
import { SongRef } from "./song.js";

/** Lifecycle of a planned service. Superset of Plan + Stage local states. */
export const ServiceState = z.enum([
  "draft",
  "published",
  "in_progress",
  "played",
  "archived",
]);
export type ServiceState = z.infer<typeof ServiceState>;

/**
 * Canonical running-order item kind. A *superset* of the kinds each app uses
 * locally — Plan (welcome/worship_set/scripture/sermon/response/closing/...) and
 * Stage (song/scripture/custom_deck/video/announcement/gap) both map onto this.
 * Anything unmapped becomes `custom`.
 */
export const ServiceItemKind = z.enum([
  "song",
  "scripture",
  "sermon",
  "reading",
  "prayer",
  "offering",
  "announcement",
  "welcome",
  "response",
  "media",
  "gap",
  "custom",
]);
export type ServiceItemKind = z.infer<typeof ServiceItemKind>;

/**
 * A reference to a planned service. Plan is the master; Stage consumes it for
 * presentation and Rec associates a recording with it. `starts_at` is an ISO
 * 8601 UTC timestamp.
 */
export const ServiceRef = z.object({
  schema_version: schemaVersionField,
  id: z.string().uuid(),
  church_id: z.string().uuid(),
  name: z.string().min(1).max(300),
  starts_at: z.string(),
  state: ServiceState,
  was_streamed: z.boolean(),
  notes: nullableField(z.string()),
});
export type ServiceRef = z.infer<typeof ServiceRef>;

/** One row of a service's running order. */
export const SetlistItem = z.object({
  position: z.number().int().min(0),
  kind: ServiceItemKind,
  title: nullableField(z.string()),
  song_ref: nullableField(SongRef),
  scripture_ref: nullableField(z.string()),
  key_override: nullableField(z.string().max(8)),
  duration_min: nullableField(z.number().int().min(0)),
  notes: nullableField(z.string()),
});
export type SetlistItem = z.infer<typeof SetlistItem>;

/** A service plus its ordered items — the unit that flows Plan → Stage. */
export const ServicePlan = z.object({
  schema_version: schemaVersionField,
  service: ServiceRef,
  items: z.array(SetlistItem),
});
export type ServicePlan = z.infer<typeof ServicePlan>;
