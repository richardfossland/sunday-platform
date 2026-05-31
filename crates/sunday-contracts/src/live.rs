use serde::{Deserialize, Serialize};

use crate::common::{default_schema_version, SCHEMA_VERSION};
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

impl LiveEvent {
    /// Build a [`LiveEvent::CueAdvanced`] signal. `sequence` is the monotonic
    /// per-service counter; `emitted_at` is supplied by the caller (no clock
    /// dependency). Mirrors the TypeScript `liveCueEvent`.
    #[allow(clippy::too_many_arguments)]
    pub fn cue_advanced(
        service_id: String,
        sequence: u64,
        emitted_at: String,
        item_id: Option<String>,
        item_position: Option<i64>,
        label: Option<String>,
        slide_index: Option<i64>,
    ) -> Self {
        LiveEvent::CueAdvanced {
            schema_version: SCHEMA_VERSION,
            service_id,
            emitted_at,
            sequence,
            item_id,
            item_position,
            label,
            slide_index,
        }
    }

    /// Build a [`LiveEvent::NowPlaying`] signal. Mirrors the TypeScript
    /// `nowPlayingEvent`.
    pub fn now_playing(
        service_id: String,
        sequence: u64,
        emitted_at: String,
        song_ref: Option<SongRef>,
        item_position: Option<i64>,
        title: Option<String>,
    ) -> Self {
        LiveEvent::NowPlaying {
            schema_version: SCHEMA_VERSION,
            service_id,
            emitted_at,
            sequence,
            song_ref,
            item_position,
            title,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cue_advanced_builder_sets_sequence_and_type() {
        let e = LiveEvent::cue_advanced(
            "svc".to_string(),
            5,
            "2026-05-31T09:01:00Z".to_string(),
            Some("item-2".to_string()),
            Some(2),
            Some("Verse 1".to_string()),
            Some(0),
        );
        match e {
            LiveEvent::CueAdvanced {
                schema_version,
                sequence,
                label,
                ..
            } => {
                assert_eq!(schema_version, SCHEMA_VERSION);
                assert_eq!(sequence, 5);
                assert_eq!(label.as_deref(), Some("Verse 1"));
            }
            _ => panic!("expected CueAdvanced"),
        }
    }

    #[test]
    fn now_playing_builder_defaults_to_none() {
        let e = LiveEvent::now_playing(
            "svc".to_string(),
            1,
            "2026-05-31T09:00:00Z".to_string(),
            None,
            None,
            None,
        );
        match e {
            LiveEvent::NowPlaying {
                sequence,
                song_ref,
                item_position,
                ..
            } => {
                assert_eq!(sequence, 1);
                assert!(song_ref.is_none());
                assert!(item_position.is_none());
            }
            _ => panic!("expected NowPlaying"),
        }
    }
}
