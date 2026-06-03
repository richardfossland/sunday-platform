//! Conformance for the compound Sunday Bridge builders: building from the loose
//! input must reproduce the SAME golden JSON (`fixtures/` at the repo root) that
//! the TypeScript `builders.test.ts` rebuilds. If Rust and TS ever disagree on
//! what `build_recording_manifest` / `build_service_plan` emit, one of these (or
//! its TS twin) fails.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value;

use sunday_contracts::{
    build_recording_manifest, build_service_plan, RecordingKind, RecordingManifestInput,
    RecordingSegmentInput, ServicePlanInput, ServiceState, SetlistItemInput, SongRef,
};

fn fixture(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(name);
    let raw = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read fixture {name}: {e}"));
    serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse fixture {name}: {e}"))
}

fn as_value<T: Serialize>(v: &T) -> Value {
    serde_json::to_value(v).expect("serialize built payload")
}

#[test]
fn build_recording_manifest_matches_golden_fixture() {
    let manifest = build_recording_manifest(&RecordingManifestInput {
        session_id: "sess-1",
        service_id: Some("33333333-3333-3333-3333-333333333333"),
        church_id: Some("11111111-1111-1111-1111-111111111111"),
        started_at: "2026-05-31T09:00:00Z",
        ended_at: Some("2026-05-31T10:05:00Z"),
        device_label: Some("USB Mixer"),
        had_preroll: true,
        is_complete: true,
        // Deliberately out of order — the builder must sort by index.
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
    });
    assert_eq!(as_value(&manifest), fixture("recording_manifest.json"));
}

#[test]
fn build_service_plan_matches_golden_fixture() {
    let song_ref: SongRef = serde_json::from_value(serde_json::json!({
        "sundaysong_id": "22222222-2222-2222-2222-222222222222",
        "local_id": "song-local-7",
        "title": "Amazing Grace",
        "ccli_song_id": "22025",
        "tono_work_id": null,
        "default_key": "G",
        "language": "en"
    }))
    .unwrap();

    let plan = build_service_plan(ServicePlanInput {
        service_id: "33333333-3333-3333-3333-333333333333",
        church_id: "11111111-1111-1111-1111-111111111111",
        name: "Sunday Morning",
        starts_at: "2026-05-31T09:00:00Z",
        state: ServiceState::Published,
        was_streamed: true,
        notes: None,
        items: vec![
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
            SetlistItemInput {
                position: 1,
                kind: "song",
                title: Some("Amazing Grace"),
                song_ref: Some(song_ref),
                scripture_ref: None,
                key_override: Some("A"),
                duration_min: Some(5),
                notes: Some("Capo 2"),
            },
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
        ],
    });
    assert_eq!(as_value(&plan), fixture("service_plan.json"));
}
