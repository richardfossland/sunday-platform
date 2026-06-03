//! Cross-language conformance: every type round-trips against the SAME golden
//! JSON the TypeScript suite uses (`fixtures/` at the repo root). If Rust and TS
//! ever disagree on a shape, this (or its TS twin) fails.

use std::fs;
use std::path::PathBuf;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

use sunday_contracts::{
    parse_handoff_url, LiveEvent, MediaHandoff, RecordingManifest, ServicePlan, SongRef,
    SundayBundle, UsageEvent,
};

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures")
}

fn load(name: &str) -> Value {
    let raw = fs::read_to_string(fixtures_dir().join(name))
        .unwrap_or_else(|e| panic!("read fixture {name}: {e}"));
    serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse fixture {name}: {e}"))
}

/// Deserialize the fixture into `T`, re-serialize, and assert it round-trips to
/// the exact same JSON value (key order ignored — `Value` compares structurally).
fn assert_round_trip<T: Serialize + DeserializeOwned>(name: &str) {
    let raw = load(name);
    let parsed: T =
        serde_json::from_value(raw.clone()).unwrap_or_else(|e| panic!("deserialize {name}: {e}"));
    let back = serde_json::to_value(&parsed).unwrap_or_else(|e| panic!("serialize {name}: {e}"));
    assert_eq!(back, raw, "round-trip mismatch for {name}");
}

#[test]
fn song_ref_round_trips() {
    assert_round_trip::<SongRef>("song_ref.json");
}

#[test]
fn usage_event_round_trips() {
    assert_round_trip::<UsageEvent>("usage_event.json");
}

#[test]
fn service_plan_round_trips() {
    assert_round_trip::<ServicePlan>("service_plan.json");
}

#[test]
fn sunday_bundle_round_trips() {
    assert_round_trip::<SundayBundle>("sunday_bundle.json");
}

#[test]
fn live_events_round_trip() {
    assert_round_trip::<LiveEvent>("live_cue.json");
    assert_round_trip::<LiveEvent>("live_now_playing.json");
    assert_round_trip::<LiveEvent>("live_service.json");
    assert_round_trip::<LiveEvent>("live_service_ended.json");
}

#[test]
fn media_handoff_round_trips() {
    assert_round_trip::<MediaHandoff>("media_handoff.json");
}

#[test]
fn recording_manifest_round_trips() {
    assert_round_trip::<RecordingManifest>("recording_manifest.json");
}

#[derive(serde::Deserialize)]
struct UrlCase {
    name: String,
    url: String,
    expected_scheme: String,
    payload: Value,
}

#[test]
fn deep_link_urls_parse_to_shared_payloads() {
    let cases: Vec<UrlCase> = serde_json::from_value(load("deeplink_urls.json")).unwrap();
    for c in cases {
        let parsed = parse_handoff_url(&c.url, &c.expected_scheme)
            .unwrap_or_else(|e| panic!("parse '{}': {e}", c.name));
        let as_value = serde_json::to_value(&parsed).unwrap();
        assert_eq!(as_value, c.payload, "payload mismatch for '{}'", c.name);
    }
}
