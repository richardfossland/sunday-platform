use serde::{Deserialize, Serialize};

use crate::common::default_schema_version;

/// "A song was displayed during a service." Mirrors SundaySong's
/// `UsageLogInputSchema` (`/v1/usage/log`); the API dedupes on `idempotency_key`.
/// `was_streamed` selects the royalty pool (streamed vs in-room).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UsageEvent {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub church_id: String,
    pub song_id: String,
    pub variant_id: Option<String>,
    /// ISO calendar date YYYY-MM-DD.
    pub service_date: String,
    pub duration_displayed_sec: Option<i64>,
    pub was_streamed: bool,
    pub idempotency_key: String,
}

/// Deterministic idempotency key so a re-sent usage event never double-counts.
pub fn make_usage_idempotency_key(service_id: &str, service_item_id: &str) -> String {
    format!("svc-{service_id}:item-{service_item_id}")
}
