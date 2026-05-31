use serde::{Deserialize, Serialize};

use crate::common::default_schema_version;
use crate::common::SundayApp;
use crate::common::SCHEMA_VERSION;
use crate::service::ServicePlan;

/// Offline export/import envelope — Sunday Bridge transport (d). A `.sundaybundle`
/// is plain JSON: portable, diffable, no cloud account required. Media bytes are
/// referenced (`media[].rel_path`), never inlined.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BundleKind {
    ServicePlan,
    SongSet,
    RecordingManifest,
    Generic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaItemKind {
    Video,
    Audio,
    Image,
    Pdf,
    Other,
}

/// A media file shipped alongside a bundle (by reference, never inlined).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaItem {
    /// Path relative to the bundle file.
    pub rel_path: String,
    /// e.g. "sha256:…" — `None` if not computed.
    pub content_hash: Option<String>,
    pub byte_size: Option<i64>,
    pub kind: MediaItemKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SundayBundle {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    /// Bundle-format version, independent of the wire `schema_version`.
    pub bundle_version: u32,
    pub kind: BundleKind,
    /// ISO 8601 UTC creation time.
    pub created_at: String,
    pub source_app: SundayApp,
    pub church_id: Option<String>,
    pub media: Vec<MediaItem>,
    /// Present when `kind == ServicePlan`.
    pub service_plan: Option<ServicePlan>,
}

/// Current `.sundaybundle` format version, independent of the wire schema.
/// Mirrors the TypeScript `BUNDLE_VERSION`.
pub const BUNDLE_VERSION: u32 = 1;

/// Wrap a [`ServicePlan`] in a `.sundaybundle` envelope of kind
/// [`BundleKind::ServicePlan`]. Media is referenced (`rel_path`), never inlined.
/// `created_at` is supplied by the caller (no clock dependency here). Mirrors the
/// TypeScript `writeServicePlanBundle`.
///
/// To READ a bundle, deserialize with `serde_json::from_str::<SundayBundle>(..)`
/// — the TypeScript `readBundle` wrapper exists only because the web side needs a
/// non-throwing, error-collecting parse; Rust callers use serde's `Result`
/// directly, so no mirror is added (kept cheap per Fase plan).
pub fn write_service_plan_bundle(
    service_plan: ServicePlan,
    source_app: SundayApp,
    church_id: Option<String>,
    media: Vec<MediaItem>,
    created_at: String,
) -> SundayBundle {
    SundayBundle {
        schema_version: SCHEMA_VERSION,
        bundle_version: BUNDLE_VERSION,
        kind: BundleKind::ServicePlan,
        created_at,
        source_app,
        church_id,
        media,
        service_plan: Some(service_plan),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::{ServiceRef, ServiceState};

    fn sample_plan() -> ServicePlan {
        ServicePlan {
            schema_version: SCHEMA_VERSION,
            service: ServiceRef {
                schema_version: SCHEMA_VERSION,
                id: "33333333-3333-3333-3333-333333333333".to_string(),
                church_id: "11111111-1111-1111-1111-111111111111".to_string(),
                name: "Sunday Morning".to_string(),
                starts_at: "2026-05-31T09:00:00Z".to_string(),
                state: ServiceState::Published,
                was_streamed: true,
                notes: None,
            },
            items: vec![],
        }
    }

    #[test]
    fn write_service_plan_bundle_wraps_envelope() {
        let plan = sample_plan();
        let bundle = write_service_plan_bundle(
            plan.clone(),
            SundayApp::SundayPlan,
            Some("11111111-1111-1111-1111-111111111111".to_string()),
            vec![],
            "2026-05-31T08:00:00Z".to_string(),
        );
        assert_eq!(bundle.kind, BundleKind::ServicePlan);
        assert_eq!(bundle.schema_version, SCHEMA_VERSION);
        assert_eq!(bundle.bundle_version, BUNDLE_VERSION);
        assert_eq!(bundle.source_app, SundayApp::SundayPlan);
        assert!(bundle.media.is_empty());
        assert_eq!(bundle.service_plan.as_ref(), Some(&plan));
    }

    #[test]
    fn write_service_plan_bundle_carries_media_and_null_church() {
        let media = vec![MediaItem {
            rel_path: "media/sermon.mov".to_string(),
            content_hash: None,
            byte_size: None,
            kind: MediaItemKind::Video,
        }];
        let bundle = write_service_plan_bundle(
            sample_plan(),
            SundayApp::SundayRec,
            None,
            media.clone(),
            "2026-05-31T08:00:00Z".to_string(),
        );
        assert!(bundle.church_id.is_none());
        assert_eq!(bundle.media, media);
    }
}
