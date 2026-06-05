import { z } from "zod";

import { nullableField, safeRelPath, schemaVersionField } from "./common.js";

/**
 * Cross-app description of what a SundayRec recording session produced — the
 * Sunday Bridge payload for {@link BundleKind} `recording_manifest`. SundayRec
 * captures a service to one or more *deliverable* files (a long service is
 * split, and a dropped connection is stitched back from reconnect fragments);
 * this manifest names each produced file by reference so a sister app
 * (SundayEdit for captions, SundayStudio for audio, SundayPlan/Stage for the
 * archive) knows what exists, how long, and which service it belongs to —
 * WITHOUT inlining any media bytes. Files live next to the bundle at
 * `rel_path` (see {@link MediaItem}); the manifest holds only metadata.
 */

/** What a recording captured. */
export const RecordingKind = z.enum(["video", "audio"]);
export type RecordingKind = z.infer<typeof RecordingKind>;

/**
 * One produced deliverable file from a recording session. A session with a
 * mid-service split yields multiple segments (`index` 0,1,2…); a clean session
 * yields a single segment. `reconnect_fragments` is how many raw captures were
 * concatenated to make this file (1 = no drops). Times are seconds from the
 * service/segment start; `started_at` is an ISO 8601 UTC wall-clock stamp.
 */
export const RecordingSegment = z.object({
  /** 0-based position of this deliverable within the session. */
  index: z.number().int().min(0),
  /** Path relative to the bundle file (the actual bytes live there). */
  rel_path: safeRelPath,
  kind: RecordingKind,
  /** Wall-clock start of this segment, ISO 8601 UTC. */
  started_at: z.string(),
  /** Recorded length in seconds (whole-second resolution), or null if unknown. */
  duration_sec: nullableField(z.number().int().min(0)),
  /** Container/codec hint, e.g. "mov", "mp4", "wav". */
  container: nullableField(z.string()),
  /** "sha256:…" content hash, or null if not computed. */
  content_hash: nullableField(z.string()),
  byte_size: nullableField(z.number().int().min(0)),
  /** Raw captures concatenated into this file (1 = no reconnect drops). */
  reconnect_fragments: z.number().int().min(1),
});
export type RecordingSegment = z.infer<typeof RecordingSegment>;

/**
 * The full manifest for a recording session: which service it captured, where
 * it was recorded, and every deliverable segment it produced. `had_preroll`
 * records whether the rolling pre-roll buffer was prepended to the first
 * segment (SundayRec's pre-roll feature). `is_complete` is false when the
 * session ended via a watchdog/crash recovery rather than a clean stop.
 */
export const RecordingManifest = z.object({
  schema_version: schemaVersionField,
  /** Manifest-format version, independent of the wire `schema_version`. */
  manifest_version: z.number().int().min(1),
  /** Stable id of the recording session. */
  session_id: z.string().min(1),
  /** The service this recording captured, if linked. */
  service_id: nullableField(z.string()),
  church_id: nullableField(z.string().uuid()),
  /** Wall-clock start of the session, ISO 8601 UTC. */
  started_at: z.string(),
  /** Wall-clock end, ISO 8601 UTC, or null if the session never closed cleanly. */
  ended_at: nullableField(z.string()),
  /** Device label the operator selected, for provenance. */
  device_label: nullableField(z.string()),
  /** Whether the pre-roll buffer was prepended to the first segment. */
  had_preroll: z.boolean(),
  /** False when the session ended via recovery rather than a clean stop. */
  is_complete: z.boolean(),
  /** Produced deliverables, in order (`index` ascending). */
  segments: z.array(RecordingSegment),
});
export type RecordingManifest = z.infer<typeof RecordingManifest>;

/** Current recording-manifest format version. */
export const RECORDING_MANIFEST_VERSION = 1 as const;

/**
 * Total recorded duration across all segments, in whole seconds. Segments with
 * an unknown (`null`) duration contribute 0. Useful for a one-line "this
 * recording is ~52 min" summary without re-probing the files.
 */
export function totalRecordedSeconds(manifest: RecordingManifest): number {
  return manifest.segments.reduce(
    (sum, seg) => sum + (seg.duration_sec ?? 0),
    0,
  );
}

/**
 * True when any segment was stitched from more than one capture — i.e. the
 * session survived at least one reconnect. A quick health flag for the
 * archive/UI ("recovered from N drops") without exposing the fragment plumbing.
 */
export function hadReconnect(manifest: RecordingManifest): boolean {
  return manifest.segments.some((seg) => seg.reconnect_fragments > 1);
}
