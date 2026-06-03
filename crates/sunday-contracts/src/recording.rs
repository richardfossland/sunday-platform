use serde::{Deserialize, Serialize};

use crate::common::default_schema_version;

/// What a recording captured. Mirrors the TypeScript `RecordingKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingKind {
    Video,
    Audio,
}

/// One produced deliverable file from a recording session. A session with a
/// mid-service split yields multiple segments (`index` 0,1,2…); a clean session
/// yields a single segment. `reconnect_fragments` is how many raw captures were
/// concatenated to make this file (1 = no drops). Times are seconds from the
/// service/segment start; `started_at` is an ISO 8601 UTC wall-clock stamp.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecordingSegment {
    /// 0-based position of this deliverable within the session.
    pub index: u32,
    /// Path relative to the bundle file (the actual bytes live there).
    pub rel_path: String,
    pub kind: RecordingKind,
    /// Wall-clock start of this segment, ISO 8601 UTC.
    pub started_at: String,
    /// Recorded length in seconds (whole-second resolution), or null if unknown.
    pub duration_sec: Option<i64>,
    /// Container/codec hint, e.g. "mov", "mp4", "wav".
    pub container: Option<String>,
    /// "sha256:…" content hash, or null if not computed.
    pub content_hash: Option<String>,
    pub byte_size: Option<i64>,
    /// Raw captures concatenated into this file (1 = no reconnect drops).
    pub reconnect_fragments: u32,
}

/// The full manifest for a recording session: which service it captured, where
/// it was recorded, and every deliverable segment it produced — the Sunday
/// Bridge payload for the `recording_manifest` bundle kind. SundayRec captures a
/// service to one or more *deliverable* files (a long service is split, and a
/// dropped connection is stitched back from reconnect fragments); this manifest
/// names each produced file by reference so a sister app (SundayEdit for
/// captions, SundayStudio for audio, SundayPlan/Stage for the archive) knows
/// what exists, how long, and which service it belongs to — WITHOUT inlining any
/// media bytes. `had_preroll` records whether the rolling pre-roll buffer was
/// prepended to the first segment; `is_complete` is false when the session ended
/// via a watchdog/crash recovery rather than a clean stop. Mirrors the
/// TypeScript `RecordingManifest`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecordingManifest {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    /// Manifest-format version, independent of the wire `schema_version`.
    pub manifest_version: u32,
    /// Stable id of the recording session.
    pub session_id: String,
    /// The service this recording captured, if linked.
    pub service_id: Option<String>,
    pub church_id: Option<String>,
    /// Wall-clock start of the session, ISO 8601 UTC.
    pub started_at: String,
    /// Wall-clock end, ISO 8601 UTC, or null if the session never closed cleanly.
    pub ended_at: Option<String>,
    /// Device label the operator selected, for provenance.
    pub device_label: Option<String>,
    /// Whether the pre-roll buffer was prepended to the first segment.
    pub had_preroll: bool,
    /// False when the session ended via recovery rather than a clean stop.
    pub is_complete: bool,
    /// Produced deliverables, in order (`index` ascending).
    pub segments: Vec<RecordingSegment>,
}

/// Current recording-manifest format version. Mirrors the TypeScript
/// `RECORDING_MANIFEST_VERSION`.
pub const RECORDING_MANIFEST_VERSION: u32 = 1;

/// Total recorded duration across all segments, in whole seconds. Segments with
/// an unknown (`None`) duration contribute 0. Useful for a one-line "this
/// recording is ~52 min" summary without re-probing the files. Mirrors the
/// TypeScript `totalRecordedSeconds`.
pub fn total_recorded_seconds(manifest: &RecordingManifest) -> i64 {
    manifest
        .segments
        .iter()
        .map(|seg| seg.duration_sec.unwrap_or(0))
        .sum()
}

/// True when any segment was stitched from more than one capture — i.e. the
/// session survived at least one reconnect. A quick health flag for the
/// archive/UI ("recovered from N drops") without exposing the fragment plumbing.
/// Mirrors the TypeScript `hadReconnect`.
pub fn had_reconnect(manifest: &RecordingManifest) -> bool {
    manifest
        .segments
        .iter()
        .any(|seg| seg.reconnect_fragments > 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_manifest() -> RecordingManifest {
        RecordingManifest {
            schema_version: 1,
            manifest_version: RECORDING_MANIFEST_VERSION,
            session_id: "sess-1".to_string(),
            service_id: Some("33333333-3333-3333-3333-333333333333".to_string()),
            church_id: Some("11111111-1111-1111-1111-111111111111".to_string()),
            started_at: "2026-05-31T09:00:00Z".to_string(),
            ended_at: Some("2026-05-31T10:05:00Z".to_string()),
            device_label: Some("USB Mixer".to_string()),
            had_preroll: true,
            is_complete: true,
            segments: vec![
                RecordingSegment {
                    index: 0,
                    rel_path: "media/part1.mov".to_string(),
                    kind: RecordingKind::Video,
                    started_at: "2026-05-31T09:00:00Z".to_string(),
                    duration_sec: Some(1800),
                    container: Some("mov".to_string()),
                    content_hash: None,
                    byte_size: Some(1048576),
                    reconnect_fragments: 1,
                },
                RecordingSegment {
                    index: 1,
                    rel_path: "media/part2.mov".to_string(),
                    kind: RecordingKind::Video,
                    started_at: "2026-05-31T09:30:00Z".to_string(),
                    duration_sec: Some(1100),
                    container: Some("mov".to_string()),
                    content_hash: None,
                    byte_size: None,
                    reconnect_fragments: 3,
                },
            ],
        }
    }

    #[test]
    fn total_recorded_seconds_sums_known_durations() {
        let m = sample_manifest();
        assert_eq!(total_recorded_seconds(&m), 2900);
    }

    #[test]
    fn total_recorded_seconds_treats_unknown_as_zero() {
        let mut m = sample_manifest();
        m.segments[0].duration_sec = None;
        m.segments.truncate(1);
        assert_eq!(total_recorded_seconds(&m), 0);
    }

    #[test]
    fn had_reconnect_flags_stitched_segments() {
        assert!(had_reconnect(&sample_manifest()));
    }

    #[test]
    fn had_reconnect_false_for_clean_session() {
        let mut m = sample_manifest();
        m.segments.truncate(1);
        m.segments[0].reconnect_fragments = 1;
        assert!(!had_reconnect(&m));
    }

    #[test]
    fn schema_version_defaults_when_omitted() {
        let raw = serde_json::json!({
            "manifest_version": 1,
            "session_id": "sess-1",
            "service_id": null,
            "church_id": null,
            "started_at": "2026-05-31T09:00:00Z",
            "ended_at": null,
            "device_label": null,
            "had_preroll": false,
            "is_complete": false,
            "segments": []
        });
        let parsed: RecordingManifest = serde_json::from_value(raw).unwrap();
        assert_eq!(parsed.schema_version, crate::common::SCHEMA_VERSION);
    }
}
