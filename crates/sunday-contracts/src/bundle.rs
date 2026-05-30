use serde::{Deserialize, Serialize};

use crate::common::default_schema_version;
use crate::common::SundayApp;
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
