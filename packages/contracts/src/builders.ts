import { SCHEMA_VERSION } from "./common.js";
import {
  RecordingManifest,
  RECORDING_MANIFEST_VERSION,
  RecordingSegment,
} from "./recording.js";
import {
  ServiceItemKind,
  ServicePlan,
  ServiceRef,
  ServiceState,
  SetlistItem,
} from "./service.js";
import { SongRef } from "./song.js";

/**
 * Higher-level Sunday Bridge builders. Where {@link buildUsageEvent},
 * {@link liveCueEvent}, and {@link nowPlayingEvent} construct a single event,
 * these assemble the two *compound* handoff payloads — the recording manifest
 * (Rec → integration handoff) and the service plan (Plan → Stage sync) — from an
 * app's looser internal shape. Every builder is PURE, DETERMINISTIC, and
 * IDEMPOTENT: the same input always yields byte-identical output (no clocks, no
 * randomness — timestamps are caller-supplied), and re-running a builder on its
 * own output is a no-op. They stamp `schema_version`/format versions, normalize
 * optional fields to `null`, and validate against the same Zod schemas the wire
 * uses, so a malformed handoff is caught at the boundary rather than downstream.
 */

/**
 * One produced deliverable, in the loose shape SundayRec's recorder tracks
 * internally (camelCase, optionals may be absent). {@link buildRecordingManifest}
 * normalizes it into a {@link RecordingSegment}.
 */
export interface RecordingSegmentInput {
  index: number;
  relPath: string;
  kind: "video" | "audio";
  /** Wall-clock start of this segment, ISO 8601 UTC. */
  startedAt: string;
  durationSec?: number | null;
  container?: string | null;
  contentHash?: string | null;
  byteSize?: number | null;
  /** Raw captures concatenated into this file; defaults to 1 (no drops). */
  reconnectFragments?: number;
}

/** Inputs for {@link buildRecordingManifest} — the Rec → integration handoff. */
export interface RecordingManifestInput {
  sessionId: string;
  serviceId?: string | null;
  churchId?: string | null;
  /** Wall-clock start of the session, ISO 8601 UTC. */
  startedAt: string;
  /** Wall-clock end, ISO 8601 UTC, or null if the session never closed cleanly. */
  endedAt?: string | null;
  deviceLabel?: string | null;
  hadPreroll?: boolean;
  isComplete?: boolean;
  segments: RecordingSegmentInput[];
}

/**
 * Build a validated {@link RecordingManifest} from a recording session. Segments
 * are sorted by `index` (ascending) so the manifest is stable regardless of the
 * order the recorder reported them, and each segment's `reconnect_fragments`
 * defaults to 1 (a clean, un-stitched capture). The session-level reconnect and
 * total-duration facts are *derived* — read them with {@link hadReconnect} and
 * {@link totalRecordedSeconds} — so they can never drift from the segment array.
 * The canonical way SundayRec emits a `recording_manifest` bundle payload for a
 * sister app (Edit/Studio/Plan/Stage).
 */
export function buildRecordingManifest(input: RecordingManifestInput): RecordingManifest {
  const segments = input.segments
    .map(
      (seg): RecordingSegment => ({
        index: seg.index,
        rel_path: seg.relPath,
        kind: seg.kind,
        started_at: seg.startedAt,
        duration_sec: seg.durationSec ?? null,
        container: seg.container ?? null,
        content_hash: seg.contentHash ?? null,
        byte_size: seg.byteSize ?? null,
        reconnect_fragments: seg.reconnectFragments ?? 1,
      }),
    )
    .sort((a, b) => a.index - b.index);

  return RecordingManifest.parse({
    schema_version: SCHEMA_VERSION,
    manifest_version: RECORDING_MANIFEST_VERSION,
    session_id: input.sessionId,
    service_id: input.serviceId ?? null,
    church_id: input.churchId ?? null,
    started_at: input.startedAt,
    ended_at: input.endedAt ?? null,
    device_label: input.deviceLabel ?? null,
    had_preroll: input.hadPreroll ?? false,
    is_complete: input.isComplete ?? false,
    segments,
  });
}

/**
 * One running-order row in the loose shape Plan/Stage track internally. An
 * unmapped kind falls back to `custom` (see {@link normalizeServiceItemKind}).
 */
export interface SetlistItemInput {
  position: number;
  kind: string;
  title?: string | null;
  songRef?: SongRef | null;
  scriptureRef?: string | null;
  keyOverride?: string | null;
  durationMin?: number | null;
  notes?: string | null;
}

/** Inputs for {@link buildServicePlan} — the Plan → Stage sync handoff. */
export interface ServicePlanInput {
  serviceId: string;
  churchId: string;
  name: string;
  /** Wall-clock start, ISO 8601 UTC. */
  startsAt: string;
  state: ServiceState;
  wasStreamed: boolean;
  notes?: string | null;
  items: SetlistItemInput[];
}

/**
 * Map an app's local item kind onto the canonical {@link ServiceItemKind}.
 * Anything the contract doesn't recognize becomes `custom` rather than throwing,
 * so a newer Plan kind never blocks a sync to an older Stage. The check is exact
 * (no case-folding) — the canonical kinds are already the lowercase wire values.
 */
export function normalizeServiceItemKind(kind: string): ServiceItemKind {
  const parsed = ServiceItemKind.safeParse(kind);
  return parsed.success ? parsed.data : "custom";
}

/**
 * Build a validated {@link ServicePlan} (a {@link ServiceRef} plus its ordered
 * {@link SetlistItem}s) from Plan's internal shape. Items are sorted by
 * `position` (ascending) for a stable running order, and each item's kind is
 * passed through {@link normalizeServiceItemKind} so an unknown kind degrades to
 * `custom` instead of failing the whole sync. The canonical unit that flows
 * Plan → Stage.
 */
export function buildServicePlan(input: ServicePlanInput): ServicePlan {
  const service = ServiceRef.parse({
    schema_version: SCHEMA_VERSION,
    id: input.serviceId,
    church_id: input.churchId,
    name: input.name,
    starts_at: input.startsAt,
    state: input.state,
    was_streamed: input.wasStreamed,
    notes: input.notes ?? null,
  });

  const items = input.items
    .map(
      (item): SetlistItem => ({
        position: item.position,
        kind: normalizeServiceItemKind(item.kind),
        title: item.title ?? null,
        song_ref: item.songRef ?? null,
        scripture_ref: item.scriptureRef ?? null,
        key_override: item.keyOverride ?? null,
        duration_min: item.durationMin ?? null,
        notes: item.notes ?? null,
      }),
    )
    .sort((a, b) => a.position - b.position);

  return ServicePlan.parse({
    schema_version: SCHEMA_VERSION,
    service,
    items,
  });
}

/**
 * Extract every {@link SongRef} a service plan references, in running order.
 * Items without a song (welcome/scripture/gap/…) are skipped. The variant
 * extractor SundaySong uses to reconcile a synced plan against its catalog
 * (licensing, recommendations) without re-walking the raw item array.
 */
export function extractSongRefs(plan: ServicePlan): SongRef[] {
  return plan.items
    .filter((item): item is SetlistItem & { song_ref: SongRef } => item.song_ref !== null)
    .map((item) => item.song_ref);
}

/**
 * Extract every scripture reference a service plan cites, in running order.
 * A companion to {@link extractSongRefs} for the readings side of a plan.
 */
export function extractScriptureRefs(plan: ServicePlan): string[] {
  return plan.items
    .filter((item): item is SetlistItem & { scripture_ref: string } => item.scripture_ref !== null)
    .map((item) => item.scripture_ref);
}

/**
 * Extract just the playable (video/audio) deliverables from a recording
 * manifest, in `index` order — the variant a captions/editing app (SundayEdit,
 * SundayStudio) walks to find files to open, skipping any manifest bookkeeping.
 */
export function extractRecordingSegments(manifest: RecordingManifest): RecordingSegment[] {
  return [...manifest.segments].sort((a, b) => a.index - b.index);
}
