//! Cross-app vocabulary mapping for service-item kinds — the pure glue the
//! Plan→Stage bridge needs. Each app keeps its own local kind vocabulary; the
//! wire contract ([`ServiceItemKind`]) is the canonical superset. Producers map
//! their kind → canonical when emitting a `ServicePlan`; consumers map canonical
//! → their own rendering. Centralised here so no bridge invents its own mapping.
//!
//! Unknown inputs map to `Custom` (forward-compatible: a new app-side kind never
//! panics, it degrades to a generic slide). Mirror of
//! `@sunday/contracts` `src/mapping.ts`.

use crate::service::ServiceItemKind;

/// SundayStage's local kinds (service_item, sql/0001_initial).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StageServiceItemKind {
    Song,
    Scripture,
    CustomDeck,
    Video,
    Announcement,
    Gap,
}

impl StageServiceItemKind {
    /// The wire string for this Stage kind (snake_case, matching the TS union).
    pub fn as_str(self) -> &'static str {
        match self {
            StageServiceItemKind::Song => "song",
            StageServiceItemKind::Scripture => "scripture",
            StageServiceItemKind::CustomDeck => "custom_deck",
            StageServiceItemKind::Video => "video",
            StageServiceItemKind::Announcement => "announcement",
            StageServiceItemKind::Gap => "gap",
        }
    }

    /// Every Stage kind, mirroring the `STAGE_KINDS` array in the TS test.
    pub const ALL: [StageServiceItemKind; 6] = [
        StageServiceItemKind::Song,
        StageServiceItemKind::Scripture,
        StageServiceItemKind::CustomDeck,
        StageServiceItemKind::Video,
        StageServiceItemKind::Announcement,
        StageServiceItemKind::Gap,
    ];
}

/// Map a SundayPlan kind to the canonical kind (unknown → `Custom`).
///
/// SundayPlan's local kinds are `template_item ∪ service_item` (migration 0002):
/// `welcome | worship_set | song | scripture | sermon | response | closing |
/// announcement | gap`.
pub fn service_item_kind_from_plan(kind: &str) -> ServiceItemKind {
    match kind {
        "welcome" => ServiceItemKind::Welcome,
        "worship_set" => ServiceItemKind::Song,
        "song" => ServiceItemKind::Song,
        "scripture" => ServiceItemKind::Scripture,
        "sermon" => ServiceItemKind::Sermon,
        "response" => ServiceItemKind::Response,
        "closing" => ServiceItemKind::Custom,
        "announcement" => ServiceItemKind::Announcement,
        "gap" => ServiceItemKind::Gap,
        _ => ServiceItemKind::Custom,
    }
}

/// Map a SundayStage kind to the canonical kind (unknown → `Custom`).
pub fn service_item_kind_from_stage(kind: &str) -> ServiceItemKind {
    match kind {
        "song" => ServiceItemKind::Song,
        "scripture" => ServiceItemKind::Scripture,
        "custom_deck" => ServiceItemKind::Custom,
        "video" => ServiceItemKind::Media,
        "announcement" => ServiceItemKind::Announcement,
        "gap" => ServiceItemKind::Gap,
        _ => ServiceItemKind::Custom,
    }
}

/// Map a canonical kind to SundayStage's rendering vocabulary.
pub fn service_item_kind_to_stage(kind: ServiceItemKind) -> StageServiceItemKind {
    match kind {
        ServiceItemKind::Song => StageServiceItemKind::Song,
        ServiceItemKind::Scripture => StageServiceItemKind::Scripture,
        ServiceItemKind::Sermon => StageServiceItemKind::CustomDeck,
        ServiceItemKind::Reading => StageServiceItemKind::Scripture,
        ServiceItemKind::Prayer => StageServiceItemKind::CustomDeck,
        ServiceItemKind::Offering => StageServiceItemKind::CustomDeck,
        ServiceItemKind::Announcement => StageServiceItemKind::Announcement,
        ServiceItemKind::Welcome => StageServiceItemKind::CustomDeck,
        ServiceItemKind::Response => StageServiceItemKind::CustomDeck,
        ServiceItemKind::Media => StageServiceItemKind::Video,
        ServiceItemKind::Gap => StageServiceItemKind::Gap,
        ServiceItemKind::Custom => StageServiceItemKind::CustomDeck,
    }
}

/// Normalise an incoming wire `kind` to canonical. Accepts canonical kinds
/// verbatim AND the legacy Plan-local kinds older emitters put on the wire
/// (`worship_set`, `closing`, …); anything else degrades to `Custom`. This is
/// the helper a CONSUMER of a `ServicePlan` should use on `SetlistItem.kind`,
/// so payloads from both pre- and post-convergence producers keep working.
/// Mirrors the TS `serviceItemKindFromWire`.
pub fn service_item_kind_from_wire(kind: &str) -> ServiceItemKind {
    match kind {
        "song" => ServiceItemKind::Song,
        "scripture" => ServiceItemKind::Scripture,
        "sermon" => ServiceItemKind::Sermon,
        "reading" => ServiceItemKind::Reading,
        "prayer" => ServiceItemKind::Prayer,
        "offering" => ServiceItemKind::Offering,
        "announcement" => ServiceItemKind::Announcement,
        "welcome" => ServiceItemKind::Welcome,
        "response" => ServiceItemKind::Response,
        "media" => ServiceItemKind::Media,
        "gap" => ServiceItemKind::Gap,
        "custom" => ServiceItemKind::Custom,
        other => service_item_kind_from_plan(other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PLAN_KINDS: [&str; 9] = [
        "welcome",
        "worship_set",
        "song",
        "scripture",
        "sermon",
        "response",
        "closing",
        "announcement",
        "gap",
    ];

    #[test]
    fn plan_maps_each_kind_to_a_valid_canonical_kind() {
        for k in PLAN_KINDS {
            // Every result must be a real canonical kind.
            assert!(ServiceItemKind::ALL.contains(&service_item_kind_from_plan(k)));
        }
        assert_eq!(
            service_item_kind_from_plan("worship_set"),
            ServiceItemKind::Song
        );
        assert_eq!(
            service_item_kind_from_plan("closing"),
            ServiceItemKind::Custom
        );
    }

    #[test]
    fn plan_unknown_kind_degrades_to_custom() {
        assert_eq!(
            service_item_kind_from_plan("liturgical_dance"),
            ServiceItemKind::Custom
        );
    }

    #[test]
    fn stage_maps_each_kind_to_a_valid_canonical_kind() {
        for k in StageServiceItemKind::ALL {
            assert!(ServiceItemKind::ALL.contains(&service_item_kind_from_stage(k.as_str())));
        }
        assert_eq!(
            service_item_kind_from_stage("custom_deck"),
            ServiceItemKind::Custom
        );
        assert_eq!(
            service_item_kind_from_stage("video"),
            ServiceItemKind::Media
        );
    }

    #[test]
    fn stage_unknown_kind_degrades_to_custom() {
        assert_eq!(
            service_item_kind_from_stage("hologram"),
            ServiceItemKind::Custom
        );
    }

    #[test]
    fn canonical_maps_every_kind_to_a_valid_stage_kind() {
        for k in ServiceItemKind::ALL {
            assert!(StageServiceItemKind::ALL.contains(&service_item_kind_to_stage(k)));
        }
        assert_eq!(
            service_item_kind_to_stage(ServiceItemKind::Song),
            StageServiceItemKind::Song
        );
        assert_eq!(
            service_item_kind_to_stage(ServiceItemKind::Media),
            StageServiceItemKind::Video
        );
        assert_eq!(
            service_item_kind_to_stage(ServiceItemKind::Sermon),
            StageServiceItemKind::CustomDeck
        );
    }

    #[test]
    fn round_trips_that_should_be_lossless() {
        // song/scripture/announcement/gap survive Plan→canonical→Stage.
        for (plan, stage) in [
            ("song", StageServiceItemKind::Song),
            ("scripture", StageServiceItemKind::Scripture),
            ("announcement", StageServiceItemKind::Announcement),
            ("gap", StageServiceItemKind::Gap),
        ] {
            assert_eq!(
                service_item_kind_to_stage(service_item_kind_from_plan(plan)),
                stage
            );
        }
    }

    #[test]
    fn wire_passes_canonical_kinds_through_verbatim() {
        for k in ServiceItemKind::ALL {
            // Each canonical kind's wire string maps back to itself.
            let wire = serde_json::to_value(k).unwrap();
            assert_eq!(service_item_kind_from_wire(wire.as_str().unwrap()), k);
        }
    }

    #[test]
    fn wire_accepts_legacy_plan_kinds_and_degrades_unknowns() {
        assert_eq!(
            service_item_kind_from_wire("worship_set"),
            ServiceItemKind::Song
        );
        assert_eq!(
            service_item_kind_from_wire("closing"),
            ServiceItemKind::Custom
        );
        assert_eq!(
            service_item_kind_from_wire("liturgical_dance"),
            ServiceItemKind::Custom
        );
        assert_eq!(service_item_kind_from_wire(""), ServiceItemKind::Custom);
    }
}
