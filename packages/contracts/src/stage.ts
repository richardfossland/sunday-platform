import { z } from "zod";

/**
 * Stage service manifest — the `service-manifest.json` cue log SundayStage
 * exports from a live session and SundayRec imports (`stage_import_manifest`)
 * to gain chapter markers + a setlist with reportable CCLI/TONO ids.
 *
 * This is the CANONICAL definition of a wire shape that was pinned in
 * production before this file existed (Stage's `sundayrec_bridge/manifest.rs`
 * producer and Rec's `integrations/stage.rs` parser are field-identical mirrors
 * of it). Two deliberate deviations from the other contracts in this package,
 * both inherited from the pinned wire:
 *
 *  - keys are **camelCase** (`startedAtMs`, not `started_at_ms`),
 *  - there is **no `schema_version` envelope** (the shape predates the
 *    convention; optional fields are simply absent, never `null`).
 *
 * `atMs`/`endMs`/`startedAtMs`/`endedAtMs` are absolute unix milliseconds.
 * Consumers must ignore unknown fields (forward-compatible).
 */

/** Song identifiers on a manifest item — the cross-suite licensing ids. */
export const StageManifestSong = z.object({
  title: z.string().optional(),
  tonoWorkId: z.string().optional(),
  ccliSongId: z.string().optional(),
  sundaysongId: z.string().optional(),
});
export type StageManifestSong = z.infer<typeof StageManifestSong>;

/** One cue in the manifest. `atMs`/`endMs` are absolute unix ms. */
export const StageManifestItem = z.object({
  atMs: z.number().int(),
  endMs: z.number().int().optional(),
  /** Stage-local item kind (`song`, `scripture`, `custom_deck`, …). */
  kind: z.string().min(1),
  /** Humanised cue label, e.g. "Amazing Grace — Verse 2". */
  label: z.string(),
  serviceItemId: z.string().optional(),
  /** The song behind a `song` item; absent for non-song items. */
  song: StageManifestSong.optional(),
});
export type StageManifestItem = z.infer<typeof StageManifestItem>;

/** A Stage cue log: which service, when it ran, and every cue shown. */
export const StageManifest = z.object({
  /** Producer tag; SundayStage always writes `"stage"`. */
  source: z.string().optional(),
  serviceId: z.string().optional(),
  churchId: z.string().optional(),
  startedAtMs: z.number().int(),
  endedAtMs: z.number().int().optional(),
  items: z.array(StageManifestItem),
});
export type StageManifest = z.infer<typeof StageManifest>;

/** The `source` value SundayStage stamps on every manifest it exports. */
export const STAGE_MANIFEST_SOURCE = "stage" as const;
