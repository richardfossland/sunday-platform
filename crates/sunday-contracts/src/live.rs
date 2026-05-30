use serde::{Deserialize, Serialize};

use crate::common::default_schema_version;
use crate::song::SongRef;

/// Live, ephemeral signals broadcast during a running service (Supabase Realtime,
/// on [`crate::live_channel`]). SIGNALS, not source of truth — the authoritative
/// record is a separate idempotent [`crate::UsageEvent`]. `sequence` is a
/// monotonic per-service counter for ordering/de-duplication. Internally tagged
/// on `type`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LiveEvent {
    /// The presenter moved to a new cue/slide.
    #[serde(rename = "cue.advanced")]
    CueAdvanced {
        #[serde(default = "default_schema_version")]
        schema_version: u32,
        service_id: String,
        emitted_at: String,
        sequence: u64,
        item_id: Option<String>,
        item_position: Option<i64>,
        label: Option<String>,
        slide_index: Option<i64>,
    },
    /// A song became the active item — Rec can drop a chapter marker here.
    #[serde(rename = "now_playing")]
    NowPlaying {
        #[serde(default = "default_schema_version")]
        schema_version: u32,
        service_id: String,
        emitted_at: String,
        sequence: u64,
        song_ref: Option<SongRef>,
        item_position: Option<i64>,
        title: Option<String>,
    },
    /// The service went live (presentation started).
    #[serde(rename = "service.live")]
    ServiceLive {
        #[serde(default = "default_schema_version")]
        schema_version: u32,
        service_id: String,
        emitted_at: String,
        sequence: u64,
    },
    /// The service ended.
    #[serde(rename = "service.ended")]
    ServiceEnded {
        #[serde(default = "default_schema_version")]
        schema_version: u32,
        service_id: String,
        emitted_at: String,
        sequence: u64,
    },
}
