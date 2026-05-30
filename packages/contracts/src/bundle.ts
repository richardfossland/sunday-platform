import { z } from "zod";

import { schemaVersionField, SundayApp } from "./common.js";
import { ServicePlan } from "./service.js";

/**
 * The offline export/import envelope — Sunday Bridge transport (d). A
 * `.sundaybundle` is plain JSON: portable, diffable, and the infrastructure-free
 * way to move a service plan (or, later, a recording manifest) between apps,
 * machines, or over email — no cloud account required. Media bytes are NOT
 * inlined; they sit next to the bundle at `media[].rel_path` (the user's own
 * storage), referenced by content hash for integrity.
 */
export const BundleKind = z.enum([
  "service_plan",
  "song_set",
  "recording_manifest",
  "generic",
]);
export type BundleKind = z.infer<typeof BundleKind>;

export const MediaItemKind = z.enum(["video", "audio", "image", "pdf", "other"]);
export type MediaItemKind = z.infer<typeof MediaItemKind>;

/** A media file shipped alongside a bundle (by reference, never inlined). */
export const MediaItem = z.object({
  /** Path relative to the bundle file. */
  rel_path: z.string().min(1),
  /** e.g. "sha256:…" — null if not computed. */
  content_hash: z.string().nullable(),
  byte_size: z.number().int().min(0).nullable(),
  kind: MediaItemKind,
});
export type MediaItem = z.infer<typeof MediaItem>;

export const SundayBundle = z.object({
  schema_version: schemaVersionField,
  /** Bundle-format version, independent of the wire schema_version. */
  bundle_version: z.number().int().min(1),
  kind: BundleKind,
  /** ISO 8601 UTC creation time. */
  created_at: z.string(),
  source_app: SundayApp,
  church_id: z.string().uuid().nullable(),
  media: z.array(MediaItem),
  /** Present when `kind === "service_plan"`. */
  service_plan: ServicePlan.nullable(),
});
export type SundayBundle = z.infer<typeof SundayBundle>;
