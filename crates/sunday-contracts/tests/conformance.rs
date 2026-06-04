//! Cross-language conformance: every type round-trips against the SAME golden
//! JSON the TypeScript suite uses (`fixtures/` at the repo root). If Rust and TS
//! ever disagree on a shape, this (or its TS twin) fails.

use std::fs;
use std::path::PathBuf;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

use sunday_contracts::{
    make_usage_idempotency_key, parse_handoff_url, LiveEvent, MediaHandoff, RecordingManifest,
    ServicePlan, SongRef, SundayBundle, UsageEvent,
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

/// The cross-app golden streams wrap their events in `{ description, service_id,
/// events: [...] }`. Pull the `events` array out as raw JSON values so each can be
/// round-tripped against its contract.
fn load_event_stream(name: &str) -> Vec<Value> {
    match load(name) {
        Value::Object(mut obj) => match obj.remove("events") {
            Some(Value::Array(events)) => events,
            _ => panic!("fixture {name} has no `events` array"),
        },
        _ => panic!("fixture {name} is not an object"),
    }
}

/// The monotonic per-service `sequence` is the same field on every `LiveEvent`
/// variant; it is the contract's ordering/de-dup key, so the stream tests assert
/// it strictly increases.
fn live_event_sequence(e: &LiveEvent) -> u64 {
    match e {
        LiveEvent::CueAdvanced { sequence, .. }
        | LiveEvent::NowPlaying { sequence, .. }
        | LiveEvent::ServiceLive { sequence, .. }
        | LiveEvent::ServiceEnded { sequence, .. } => *sequence,
    }
}

fn live_event_service_id(e: &LiveEvent) -> &str {
    match e {
        LiveEvent::CueAdvanced { service_id, .. }
        | LiveEvent::NowPlaying { service_id, .. }
        | LiveEvent::ServiceLive { service_id, .. }
        | LiveEvent::ServiceEnded { service_id, .. } => service_id,
    }
}

/// Stage→Rec golden stream: every event round-trips as a `LiveEvent`, the
/// `sequence` is strictly monotonic, and all events carry the one service id.
#[test]
fn stage_to_rec_cue_stream_round_trips_and_is_monotonic() {
    let events = load_event_stream("stage-to-rec-cues.json");
    assert!(!events.is_empty(), "expected a non-empty cue stream");

    let mut prev_seq: Option<u64> = None;
    for raw in &events {
        let parsed: LiveEvent = serde_json::from_value(raw.clone())
            .unwrap_or_else(|e| panic!("deserialize live event: {e}"));
        let back = serde_json::to_value(&parsed).unwrap();
        assert_eq!(&back, raw, "live event round-trip mismatch");

        let seq = live_event_sequence(&parsed);
        if let Some(p) = prev_seq {
            assert!(seq > p, "sequence not strictly monotonic: {p} -> {seq}");
        }
        prev_seq = Some(seq);

        assert_eq!(
            live_event_service_id(&parsed),
            "33333333-3333-3333-3333-333333333333",
            "all stream events belong to the one service",
        );
    }
}

/// Stage→Song golden stream: every event round-trips as a `UsageEvent`, each
/// `idempotency_key` matches the contract formula (so the API can dedupe), and
/// keys are unique per service item (the shown-items guard collapses re-shows).
#[test]
fn stage_to_song_usage_stream_round_trips_with_derived_keys() {
    let events = load_event_stream("stage-to-song-usage.json");
    assert!(!events.is_empty(), "expected a non-empty usage stream");
    let service_id = "33333333-3333-3333-3333-333333333333";

    // The stream is one usage event per service item, in advance order.
    let service_item_ids = ["item-a", "item-b"];
    let mut seen_keys = std::collections::HashSet::new();

    for (raw, item_id) in events.iter().zip(service_item_ids) {
        let parsed: UsageEvent = serde_json::from_value(raw.clone())
            .unwrap_or_else(|e| panic!("deserialize usage event: {e}"));
        let back = serde_json::to_value(&parsed).unwrap();
        assert_eq!(&back, raw, "usage event round-trip mismatch");

        let expected_key = make_usage_idempotency_key(service_id, item_id);
        assert_eq!(
            parsed.idempotency_key, expected_key,
            "idempotency_key does not match the contract formula",
        );
        assert!(
            seen_keys.insert(parsed.idempotency_key.clone()),
            "duplicate idempotency_key in usage stream",
        );
    }
}
