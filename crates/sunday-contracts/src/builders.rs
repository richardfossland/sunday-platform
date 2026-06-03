//! Higher-level Sunday Bridge builders. Where [`crate::build_usage_event`]
//! constructs a single event, these assemble the two *compound* handoff payloads
//! — the recording manifest (Rec → integration handoff) and the service plan
//! (Plan → Stage sync) — from an app's looser internal shape. Every builder is
//! PURE, DETERMINISTIC, and IDEMPOTENT: the same input always yields the same
//! output (timestamps are caller-supplied, no clocks/randomness), and re-running
//! a builder on its own output is a no-op. Mirrors the TypeScript `builders.ts`.

use crate::common::SCHEMA_VERSION;
use crate::recording::{
    RecordingKind, RecordingManifest, RecordingSegment, RECORDING_MANIFEST_VERSION,
};
use crate::service::{ServiceItemKind, ServicePlan, ServiceRef, ServiceState, SetlistItem};
use crate::song::SongRef;

/// One produced deliverable, in the loose shape SundayRec's recorder tracks
/// internally. [`build_recording_manifest`] normalizes it into a
/// [`RecordingSegment`]. Mirrors the TypeScript `RecordingSegmentInput`.
pub struct RecordingSegmentInput<'a> {
    pub index: u32,
    pub rel_path: &'a str,
    pub kind: RecordingKind,
    /// Wall-clock start of this segment, ISO 8601 UTC.
    pub started_at: &'a str,
    pub duration_sec: Option<i64>,
    pub container: Option<&'a str>,
    pub content_hash: Option<&'a str>,
    pub byte_size: Option<i64>,
    /// Raw captures concatenated into this file (1 = no drops).
    pub reconnect_fragments: u32,
}

/// Inputs for [`build_recording_manifest`] — the Rec → integration handoff.
/// Mirrors the TypeScript `RecordingManifestInput`.
pub struct RecordingManifestInput<'a> {
    pub session_id: &'a str,
    pub service_id: Option<&'a str>,
    pub church_id: Option<&'a str>,
    /// Wall-clock start of the session, ISO 8601 UTC.
    pub started_at: &'a str,
    /// Wall-clock end, ISO 8601 UTC, or None if the session never closed cleanly.
    pub ended_at: Option<&'a str>,
    pub device_label: Option<&'a str>,
    pub had_preroll: bool,
    pub is_complete: bool,
    pub segments: Vec<RecordingSegmentInput<'a>>,
}

/// Build a [`RecordingManifest`] from a recording session. Segments are sorted by
/// `index` (ascending) so the manifest is stable regardless of the order the
/// recorder reported them. The session-level reconnect and total-duration facts
/// are *derived* (read them with [`crate::had_reconnect`] /
/// [`crate::total_recorded_seconds`]) so they can never drift from the segment
/// array. Mirrors the TypeScript `buildRecordingManifest`.
pub fn build_recording_manifest(input: &RecordingManifestInput) -> RecordingManifest {
    let mut segments: Vec<RecordingSegment> = input
        .segments
        .iter()
        .map(|seg| RecordingSegment {
            index: seg.index,
            rel_path: seg.rel_path.to_string(),
            kind: seg.kind,
            started_at: seg.started_at.to_string(),
            duration_sec: seg.duration_sec,
            container: seg.container.map(str::to_string),
            content_hash: seg.content_hash.map(str::to_string),
            byte_size: seg.byte_size,
            reconnect_fragments: seg.reconnect_fragments,
        })
        .collect();
    segments.sort_by_key(|seg| seg.index);

    RecordingManifest {
        schema_version: SCHEMA_VERSION,
        manifest_version: RECORDING_MANIFEST_VERSION,
        session_id: input.session_id.to_string(),
        service_id: input.service_id.map(str::to_string),
        church_id: input.church_id.map(str::to_string),
        started_at: input.started_at.to_string(),
        ended_at: input.ended_at.map(str::to_string),
        device_label: input.device_label.map(str::to_string),
        had_preroll: input.had_preroll,
        is_complete: input.is_complete,
        segments,
    }
}

/// One running-order row in the loose shape Plan/Stage track internally. An
/// unmapped kind falls back to `custom` (see [`normalize_service_item_kind`]).
/// Mirrors the TypeScript `SetlistItemInput`.
pub struct SetlistItemInput<'a> {
    pub position: u32,
    pub kind: &'a str,
    pub title: Option<&'a str>,
    pub song_ref: Option<SongRef>,
    pub scripture_ref: Option<&'a str>,
    pub key_override: Option<&'a str>,
    pub duration_min: Option<i64>,
    pub notes: Option<&'a str>,
}

/// Inputs for [`build_service_plan`] — the Plan → Stage sync handoff. Mirrors the
/// TypeScript `ServicePlanInput`.
pub struct ServicePlanInput<'a> {
    pub service_id: &'a str,
    pub church_id: &'a str,
    pub name: &'a str,
    /// Wall-clock start, ISO 8601 UTC.
    pub starts_at: &'a str,
    pub state: ServiceState,
    pub was_streamed: bool,
    pub notes: Option<&'a str>,
    pub items: Vec<SetlistItemInput<'a>>,
}

/// Map an app's local item kind onto the canonical [`ServiceItemKind`]. Anything
/// the contract doesn't recognize becomes `Custom` rather than failing, so a
/// newer Plan kind never blocks a sync to an older Stage. The match is exact (no
/// case-folding) — the canonical kinds are the lowercase wire values. Mirrors the
/// TypeScript `normalizeServiceItemKind`.
pub fn normalize_service_item_kind(kind: &str) -> ServiceItemKind {
    match kind {
        "song" => ServiceItemKind::Song,
        "scripture" => ServiceItemKind::Scripture,
        "sermon" => ServiceItemKind::Sermon,
        "reading" => ServiceItemKind::Reading,
        "prayer" => ServiceItemKind::Prayer,
        "offering" => ServiceItemKind::Offering,
        "announcement" => ServiceItemKind::Announcement,
        "welcome" => ServiceItemKind::Welcome,
        "response" => ServiceItemKind::Response,
        "media" => ServiceItemKind::Media,
        "gap" => ServiceItemKind::Gap,
        _ => ServiceItemKind::Custom,
    }
}

/// Build a [`ServicePlan`] (a [`ServiceRef`] plus its ordered [`SetlistItem`]s)
/// from Plan's internal shape. Items are sorted by `position` (ascending) for a
/// stable running order, and each item's kind passes through
/// [`normalize_service_item_kind`] so an unknown kind degrades to `Custom`
/// instead of failing the whole sync. Mirrors the TypeScript `buildServicePlan`.
pub fn build_service_plan(input: ServicePlanInput) -> ServicePlan {
    let service = ServiceRef {
        schema_version: SCHEMA_VERSION,
        id: input.service_id.to_string(),
        church_id: input.church_id.to_string(),
        name: input.name.to_string(),
        starts_at: input.starts_at.to_string(),
        state: input.state,
        was_streamed: input.was_streamed,
        notes: input.notes.map(str::to_string),
    };

    let mut items: Vec<SetlistItem> = input
        .items
        .into_iter()
        .map(|item| SetlistItem {
            position: item.position,
            kind: normalize_service_item_kind(item.kind),
            title: item.title.map(str::to_string),
            song_ref: item.song_ref,
            scripture_ref: item.scripture_ref.map(str::to_string),
            key_override: item.key_override.map(str::to_string),
            duration_min: item.duration_min,
            notes: item.notes.map(str::to_string),
        })
        .collect();
    items.sort_by_key(|item| item.position);

    ServicePlan {
        schema_version: SCHEMA_VERSION,
        service,
        items,
    }
}

/// Extract every [`SongRef`] a service plan references, in running order. Items
/// without a song are skipped. Mirrors the TypeScript `extractSongRefs`.
pub fn extract_song_refs(plan: &ServicePlan) -> Vec<SongRef> {
    plan.items
        .iter()
        .filter_map(|item| item.song_ref.clone())
        .collect()
}

/// Extract every scripture reference a service plan cites, in running order.
/// Mirrors the TypeScript `extractScriptureRefs`.
pub fn extract_scripture_refs(plan: &ServicePlan) -> Vec<String> {
    plan.items
        .iter()
        .filter_map(|item| item.scripture_ref.clone())
        .collect()
}

/// Extract the playable deliverables from a recording manifest, in `index` order.
/// Mirrors the TypeScript `extractRecordingSegments`.
pub fn extract_recording_segments(manifest: &RecordingManifest) -> Vec<RecordingSegment> {
    let mut segments = manifest.segments.clone();
    segments.sort_by_key(|seg| seg.index);
    segments
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{had_reconnect, total_recorded_seconds};

    fn sample_manifest_input() -> RecordingManifestInput<'static> {
        RecordingManifestInput {
            session_id: "sess-1",
            service_id: Some("33333333-3333-3333-3333-333333333333"),
            church_id: Some("11111111-1111-1111-1111-111111111111"),
            started_at: "2026-05-31T09:00:00Z",
            ended_at: Some("2026-05-31T10:05:00Z"),
            device_label: Some("USB Mixer"),
            had_preroll: true,
            is_complete: true,
            segments: vec![
                RecordingSegmentInput {
                    index: 1,
                    rel_path: "media/part2.mov",
                    kind: RecordingKind::Video,
                    started_at: "2026-05-31T09:30:00Z",
                    duration_sec: Some(1100),
                    container: Some("mov"),
                    content_hash: None,
                    byte_size: None,
                    reconnect_fragments: 3,
                },
                RecordingSegmentInput {
                    index: 0,
                    rel_path: "media/part1.mov",
                    kind: RecordingKind::Video,
                    started_at: "2026-05-31T09:00:00Z",
                    duration_sec: Some(1800),
                    container: Some("mov"),
                    content_hash: None,
                    byte_size: Some(1048576),
                    reconnect_fragments: 1,
                },
            ],
        }
    }

    #[test]
    fn build_recording_manifest_stamps_versions_and_sorts() {
        let m = build_recording_manifest(&sample_manifest_input());
        assert_eq!(m.schema_version, SCHEMA_VERSION);
        assert_eq!(m.manifest_version, RECORDING_MANIFEST_VERSION);
        assert_eq!(
            m.segments.iter().map(|s| s.index).collect::<Vec<_>>(),
            vec![0, 1]
        );
        assert_eq!(total_recorded_seconds(&m), 2900);
        assert!(had_reconnect(&m));
    }

    #[test]
    fn build_recording_manifest_is_idempotent() {
        assert_eq!(
            build_recording_manifest(&sample_manifest_input()),
            build_recording_manifest(&sample_manifest_input())
        );
    }

    #[test]
    fn build_recording_manifest_empty_null_edge_case() {
        let m = build_recording_manifest(&RecordingManifestInput {
            session_id: "sess-2",
            service_id: None,
            church_id: None,
            started_at: "2026-05-31T09:00:00Z",
            ended_at: None,
            device_label: None,
            had_preroll: false,
            is_complete: false,
            segments: vec![],
        });
        assert!(m.church_id.is_none());
        assert!(m.service_id.is_none());
        assert!(m.ended_at.is_none());
        assert_eq!(total_recorded_seconds(&m), 0);
        assert!(!had_reconnect(&m));
    }

    fn sample_plan_input() -> ServicePlanInput<'static> {
        ServicePlanInput {
            service_id: "33333333-3333-3333-3333-333333333333",
            church_id: "11111111-1111-1111-1111-111111111111",
            name: "Sunday Morning",
            starts_at: "2026-05-31T09:00:00Z",
            state: ServiceState::Published,
            was_streamed: true,
            notes: None,
            items: vec![
                SetlistItemInput {
                    position: 2,
                    kind: "scripture",
                    title: Some("Reading"),
                    song_ref: None,
                    scripture_ref: Some("John 3:16-21"),
                    key_override: None,
                    duration_min: Some(2),
                    notes: None,
                },
                SetlistItemInput {
                    position: 0,
                    kind: "welcome",
                    title: Some("Welcome & notices"),
                    song_ref: None,
                    scripture_ref: None,
                    key_override: None,
                    duration_min: Some(3),
                    notes: None,
                },
            ],
        }
    }

    #[test]
    fn build_service_plan_stamps_versions_and_sorts() {
        let p = build_service_plan(sample_plan_input());
        assert_eq!(p.schema_version, SCHEMA_VERSION);
        assert_eq!(p.service.schema_version, SCHEMA_VERSION);
        assert_eq!(
            p.items.iter().map(|i| i.position).collect::<Vec<_>>(),
            vec![0, 2]
        );
    }

    #[test]
    fn build_service_plan_degrades_unknown_kind_to_custom() {
        let p = build_service_plan(ServicePlanInput {
            items: vec![SetlistItemInput {
                position: 0,
                kind: "liturgy_chant",
                title: Some("Kyrie"),
                song_ref: None,
                scripture_ref: None,
                key_override: None,
                duration_min: None,
                notes: None,
            }],
            ..sample_plan_input()
        });
        assert_eq!(p.items[0].kind, ServiceItemKind::Custom);
    }

    #[test]
    fn normalize_service_item_kind_maps_known_and_unknown() {
        assert_eq!(normalize_service_item_kind("song"), ServiceItemKind::Song);
        assert_eq!(
            normalize_service_item_kind("scripture"),
            ServiceItemKind::Scripture
        );
        assert_eq!(
            normalize_service_item_kind("liturgy_chant"),
            ServiceItemKind::Custom
        );
        assert_eq!(normalize_service_item_kind(""), ServiceItemKind::Custom);
    }

    #[test]
    fn extract_scripture_refs_collects_in_order() {
        let p = build_service_plan(sample_plan_input());
        assert_eq!(extract_scripture_refs(&p), vec!["John 3:16-21".to_string()]);
        assert!(extract_song_refs(&p).is_empty());
    }

    #[test]
    fn extract_recording_segments_orders_by_index() {
        let m = build_recording_manifest(&sample_manifest_input());
        let segs = extract_recording_segments(&m);
        assert_eq!(
            segs.iter().map(|s| s.rel_path.as_str()).collect::<Vec<_>>(),
            vec!["media/part1.mov", "media/part2.mov"]
        );
    }
}
