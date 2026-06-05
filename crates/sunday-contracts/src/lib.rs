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
mod usage;

pub use builders::{
    build_recording_manifest, build_service_plan, extract_recording_segments,
    extract_scripture_refs, extract_song_refs, normalize_service_item_kind, RecordingManifestInput,
    RecordingSegmentInput, ServicePlanInput, SetlistItemInput,
};
pub use bundle::{
    write_service_plan_bundle, BundleKind, MediaItem, MediaItemKind, SundayBundle, BUNDLE_VERSION,
};
pub use common::{
    default_schema_version, is_safe_rel_path, live_channel, ContractError, SundayApp,
    SCHEMA_VERSION,
};
pub use deeplink::{
    build_handoff_url, decode_component, encode_component, parse_handoff_url, result_callback_url,
    MediaHandoff, MediaKind, ACTION_IMPORT,
};
pub use live::LiveEvent;
pub use mapping::{
    service_item_kind_from_plan, service_item_kind_from_stage, service_item_kind_to_stage,
    StageServiceItemKind,
};
pub use recording::{
    had_reconnect, total_recorded_seconds, RecordingKind, RecordingManifest, RecordingSegment,
    RECORDING_MANIFEST_VERSION,
};
pub use service::{ServiceItemKind, ServicePlan, ServiceRef, ServiceState, SetlistItem};
pub use song::SongRef;
pub use usage::{build_usage_event, make_usage_idempotency_key, BuildUsageEventInput, UsageEvent};
