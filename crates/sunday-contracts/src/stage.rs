//! Stage service manifest — the `service-manifest.json` cue log SundayStage
//! exports from a live session and SundayRec imports (`stage_import_manifest`)
//! to gain chapter markers + a setlist with reportable CCLI/TONO ids.
//!
//! This is the CANONICAL definition of a wire shape that was pinned in
//! production before this module existed (Stage's `sundayrec_bridge/manifest.rs`
//! producer and Rec's `integrations/stage.rs` parser are field-identical mirrors
//! of it). Two deliberate deviations from the other contracts in this crate,
//! both inherited from the pinned wire:
//!
//!  - keys are **camelCase** (`startedAtMs`, not `started_at_ms`),
//!  - there is **no `schema_version` envelope** (the shape predates the
//!    convention; optional fields are simply absent, never `null`).
//!
//! `at_ms`/`end_ms`/`started_at_ms`/`ended_at_ms` are absolute unix
//! milliseconds. Unknown fields are ignored on read (forward-compatible).

use serde::{Deserialize, Serialize};

/// The `source` value SundayStage stamps on every manifest it exports.
pub const STAGE_MANIFEST_SOURCE: &str = "stage";

/// Song identifiers on a manifest item — the cross-suite licensing ids.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StageManifestSong {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tono_work_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ccli_song_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sundaysong_id: Option<String>,
}

/// One cue in the manifest. `at_ms`/`end_ms` are absolute unix ms.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageManifestItem {
    pub at_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_ms: Option<i64>,
    /// Stage-local item kind (`song`, `scripture`, `custom_deck`, …).
    pub kind: String,
    /// Humanised cue label, e.g. "Amazing Grace — Verse 2".
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_item_id: Option<String>,
    /// The song behind a `song` item; absent for non-song items.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub song: Option<StageManifestSong>,
}

/// A Stage cue log: which service, when it ran, and every cue shown.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageManifest {
    /// Producer tag; SundayStage always writes `"stage"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub church_id: Option<String>,
    pub started_at_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at_ms: Option<i64>,
    pub items: Vec<StageManifestItem>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn optional_fields_may_be_absent() {
        // The minimal manifest Rec's parser accepts: startedAtMs + items.
        let json = r#"{"startedAtMs":1000,"items":[{"atMs":1000,"kind":"song","label":"Hymn"}]}"#;
        let m: StageManifest = serde_json::from_str(json).unwrap();
        assert_eq!(m.started_at_ms, 1000);
        assert_eq!(m.items.len(), 1);
        assert!(m.source.is_none());
        // Absent options stay absent on re-serialize (never `null`).
        let back = serde_json::to_string(&m).unwrap();
        assert!(
            !back.contains("null"),
            "absent fields must be omitted: {back}"
        );
    }

    #[test]
    fn wire_keys_are_camel_case() {
        let m = StageManifest {
            source: Some(STAGE_MANIFEST_SOURCE.to_string()),
            service_id: Some("svc".into()),
            church_id: None,
            started_at_ms: 1,
            ended_at_ms: Some(2),
            items: vec![],
        };
        let v = serde_json::to_value(&m).unwrap();
        assert!(v.get("startedAtMs").is_some());
        assert!(v.get("serviceId").is_some());
        assert!(v.get("endedAtMs").is_some());
        assert!(v.get("started_at_ms").is_none());
    }
}
