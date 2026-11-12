//! `sunday-contracts` — the Rust mirror of `@sunday/contracts`.
//!
//! Canonical cross-app wire contracts for the Sunday suite, consumed by the
//! Tauri desktop apps (SundayRec, SundayStage, SundayEdit, SundayStudio,
//! SundayPaper). The shapes here match the TypeScript/Zod package exactly; the
//! shared golden JSON in `fixtures/` (repo root) is what both languages
//! round-trip against (`tests/conformance.rs` here, `test/conformance.test.ts`
//! there). If the two ever diverge, a fixture test fails.
//!
//! Every payload carries a `schema_version` (currently [`SCHEMA_VERSION`]).
//! Unknown fields are ignored on read (serde's default) so the contract can grow
//! without breaking older builds.

mod builders;
mod bundle;
mod common;
mod deeplink;
mod live;
mod mapping;
mod recording;
mod service;
mod song;
mod stage;
mod usage;

pub use builders::{
    RecordingManifestInput, RecordingSegmentInput, ServicePlanInput, SetlistItemInput,
    build_recording_manifest, build_service_plan, extract_recording_segments,
    extract_scripture_refs, extract_song_refs, normalize_service_item_kind,
};
pub use bundle::{
    BUNDLE_VERSION, BundleKind, MediaItem, MediaItemKind, SundayBundle, write_service_plan_bundle,
};
pub use common::{
    ContractError, SCHEMA_VERSION, SundayApp, default_schema_version, is_safe_rel_path,
    live_channel,
};
pub use deeplink::{
    ACTION_IMPORT, MediaHandoff, MediaKind, build_handoff_url, decode_component, encode_component,
    parse_handoff_url, result_callback_url,
};
pub use live::LiveEvent;
pub use mapping::{
    StageServiceItemKind, service_item_kind_from_plan, service_item_kind_from_stage,
    service_item_kind_from_wire, service_item_kind_to_stage,
};
pub use recording::{
    RECORDING_MANIFEST_VERSION, RecordingKind, RecordingManifest, RecordingSegment, had_reconnect,
    total_recorded_seconds,
};
pub use service::{ServiceItemKind, ServicePlan, ServiceRef, ServiceState, SetlistItem};
pub use song::SongRef;
pub use stage::{STAGE_MANIFEST_SOURCE, StageManifest, StageManifestItem, StageManifestSong};
pub use usage::{BuildUsageEventInput, UsageEvent, build_usage_event, make_usage_idempotency_key};
