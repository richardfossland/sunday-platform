use serde::{Deserialize, Serialize};

use crate::common::{default_schema_version, SCHEMA_VERSION};

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

/// Inputs for [`build_usage_event`] — the Stage→Song usage bridge. Mirrors the
/// TypeScript `BuildUsageEventInput`.
pub struct BuildUsageEventInput<'a> {
    pub church_id: &'a str,
    pub song_id: &'a str,
    pub variant_id: Option<&'a str>,
    /// ISO calendar date YYYY-MM-DD.
    pub service_date: &'a str,
    pub was_streamed: bool,
    pub duration_displayed_sec: Option<i64>,
    /// The service this song was shown in — feeds the idempotency key.
    pub service_id: &'a str,
    /// The running-order item — feeds the idempotency key.
    pub service_item_id: &'a str,
}

/// Build a [`UsageEvent`] from a service item, deriving the dedupe key with
/// [`make_usage_idempotency_key`]. Mirrors the TypeScript `buildUsageEvent`.
pub fn build_usage_event(input: &BuildUsageEventInput) -> UsageEvent {
    UsageEvent {
        schema_version: SCHEMA_VERSION,
        church_id: input.church_id.to_string(),
        song_id: input.song_id.to_string(),
        variant_id: input.variant_id.map(str::to_string),
        service_date: input.service_date.to_string(),
        duration_displayed_sec: input.duration_displayed_sec,
        was_streamed: input.was_streamed,
        idempotency_key: make_usage_idempotency_key(input.service_id, input.service_item_id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_usage_event_derives_stable_key() {
        let input = BuildUsageEventInput {
            church_id: "c1",
            song_id: "s1",
            variant_id: None,
            service_date: "2026-05-31",
            was_streamed: true,
            duration_displayed_sec: None,
            service_id: "svc-9",
            service_item_id: "1",
        };
        let e = build_usage_event(&input);
        assert_eq!(e.idempotency_key, make_usage_idempotency_key("svc-9", "1"));
        assert_eq!(e.schema_version, SCHEMA_VERSION);
        assert!(e.variant_id.is_none());
        assert!(e.was_streamed);
    }

    #[test]
    fn build_usage_event_carries_optional_fields() {
        let input = BuildUsageEventInput {
            church_id: "c1",
            song_id: "s1",
            variant_id: Some("v1"),
            service_date: "2026-05-31",
            was_streamed: false,
            duration_displayed_sec: Some(312),
            service_id: "svc-9",
            service_item_id: "2",
        };
        let e = build_usage_event(&input);
        assert_eq!(e.variant_id.as_deref(), Some("v1"));
        assert_eq!(e.duration_displayed_sec, Some(312));
    }
}
