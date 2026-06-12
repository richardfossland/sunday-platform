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
    ServicePlan, SongRef, StageManifest, SundayBundle, UsageEvent,
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

#[test]
fn stage_manifest_round_trips() {
    assert_round_trip::<StageManifest>("stage_manifest.json");
}

/// Forward-compatibility (the Rust half of the cross-language parity the TS
/// `conformance.test.ts` asserts): a payload from a NEWER app — a higher
/// `schema_version` — must still deserialize, because `schema_version` is a
/// plain `u32` with no upper bound. The TS contract now matches (a positive int,
/// not a hard `z.literal(1)`), so neither language split-brains on a future
/// `.sundaybundle`/event.
#[test]
fn future_schema_version_deserializes() {
    let mut raw = load("usage_event.json");
    raw["schema_version"] = serde_json::json!(2);
    let parsed: UsageEvent = serde_json::from_value(raw).expect("future usage_event");
    assert_eq!(parsed.schema_version, 2);

    let mut raw = load("recording_manifest.json");
    raw["schema_version"] = serde_json::json!(7);
    let parsed: RecordingManifest = serde_json::from_value(raw).expect("future manifest");
    assert_eq!(parsed.schema_version, 7);

    let mut raw = load("sunday_bundle.json");
    raw["schema_version"] = serde_json::json!(99);
    let parsed: SundayBundle = serde_json::from_value(raw).expect("future bundle");
    assert_eq!(parsed.schema_version, 99);
}

/// Nullable-field parity (the Rust half): an OMITTED nullable key deserializes to
/// `None`. The TS contract now does the same (omitted -> null via `nullableField`),
/// so a hand-written manifest/bundle that drops a None field parses in BOTH
/// languages rather than only in Rust.
#[test]
fn omitted_nullable_key_deserializes_as_none() {
    let mut raw = load("recording_manifest.json");
    raw.as_object_mut().unwrap().remove("device_label");
    let parsed: RecordingManifest =
        serde_json::from_value(raw).expect("manifest sans device_label");
    assert!(parsed.device_label.is_none());

    let mut raw = load("sunday_bundle.json");
    raw.as_object_mut().unwrap().remove("church_id");
    let parsed: SundayBundle = serde_json::from_value(raw).expect("bundle sans church_id");
    assert!(parsed.church_id.is_none());

    let mut raw = load("usage_event.json");
    raw.as_object_mut().unwrap().remove("variant_id");
    let parsed: UsageEvent = serde_json::from_value(raw).expect("usage sans variant_id");
    assert!(parsed.variant_id.is_none());
}

/// Forward-compat *upper boundary* (the Rust half): `schema_version` is a `u32`,
/// so the largest value an app could ever emit (`u32::MAX`) must still parse —
/// the TS twin caps at the same `2^32 - 1` so neither side rejects a far-future
/// bundle at the offline import boundary.
#[test]
fn schema_version_u32_max_boundary_deserializes() {
    let mut raw = load("sunday_bundle.json");
    raw["schema_version"] = serde_json::json!(u32::MAX);
    let parsed: SundayBundle = serde_json::from_value(raw).expect("u32::MAX bundle");
    assert_eq!(parsed.schema_version, u32::MAX);

    // One past the u32 ceiling is NOT a valid schema_version (overflows the type).
    let mut raw = load("sunday_bundle.json");
    raw["schema_version"] = serde_json::json!(u64::from(u32::MAX) + 1);
    assert!(
        serde_json::from_value::<SundayBundle>(raw).is_err(),
        "schema_version above u32::MAX must not deserialize",
    );
}

/// Edge case: a ServicePlan with ZERO items (a placeholder service created in
/// Plan before anyone has built the setlist) must round-trip. `items` is an
/// unbounded `Vec` with no non-empty floor, so an empty plan is a first-class
/// state that flows Plan → Stage like any other.
#[test]
fn empty_service_plan_round_trips() {
    let mut raw = load("service_plan.json");
    raw["items"] = serde_json::json!([]);
    let parsed: ServicePlan = serde_json::from_value(raw.clone()).expect("zero-item service plan");
    assert!(parsed.items.is_empty());
    let back = serde_json::to_value(&parsed).unwrap();
    assert_eq!(back, raw, "empty-plan round-trip mismatch");
}

/// Edge case: an in-progress recording — the manifest written while a service is
/// still live — has a null `ended_at` (and `is_complete: false`). It must
/// round-trip so a crash-recovery / live-monitor consumer can read the partial
/// manifest. `ended_at` is `Option<String>`; the TS twin uses `nullableField`.
#[test]
fn in_progress_manifest_null_ended_at_round_trips() {
    let mut raw = load("recording_manifest.json");
    raw["ended_at"] = serde_json::Value::Null;
    raw["is_complete"] = serde_json::json!(false);
    let parsed: RecordingManifest =
        serde_json::from_value(raw.clone()).expect("in-progress manifest");
    assert!(parsed.ended_at.is_none());
    assert!(!parsed.is_complete);
    let back = serde_json::to_value(&parsed).unwrap();
    assert_eq!(back, raw, "in-progress manifest round-trip mismatch");
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
