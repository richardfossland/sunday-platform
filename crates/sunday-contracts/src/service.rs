use serde::{Deserialize, Serialize};

use crate::common::default_schema_version;
use crate::song::SongRef;

/// Lifecycle of a planned service. Superset of Plan + Stage local states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceState {
    Draft,
    Published,
    InProgress,
    Played,
    Archived,
}

/// Canonical running-order item kind — a superset both Plan and Stage map onto.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceItemKind {
    Song,
    Scripture,
    Sermon,
    Reading,
    Prayer,
    Offering,
    Announcement,
    Welcome,
    Response,
    Media,
    Gap,
    Custom,
}

/// A reference to a planned service. Plan is the master; Stage presents it and
/// Rec associates a recording with it. `starts_at` is ISO 8601 UTC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServiceRef {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub id: String,
    pub church_id: String,
    pub name: String,
    pub starts_at: String,
    pub state: ServiceState,
    pub was_streamed: bool,
    pub notes: Option<String>,
}

/// One row of a service's running order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetlistItem {
    pub position: u32,
    pub kind: ServiceItemKind,
    pub title: Option<String>,
    pub song_ref: Option<SongRef>,
    pub scripture_ref: Option<String>,
    pub key_override: Option<String>,
    pub duration_min: Option<i64>,
    pub notes: Option<String>,
}

/// A service plus its ordered items — the unit that flows Plan → Stage.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServicePlan {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub service: ServiceRef,
    pub items: Vec<SetlistItem>,
}
