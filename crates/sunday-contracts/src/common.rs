use serde::{Deserialize, Serialize};

/// Current Sunday wire-contract version. Bump ONLY on a breaking change, paired
/// with a deprecation cycle. See the crate docs.
pub const SCHEMA_VERSION: u32 = 1;

/// serde `default` for the `schema_version` field on every payload.
pub fn default_schema_version() -> u32 {
    SCHEMA_VERSION
}

/// The apps that make up the Sunday suite.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SundayApp {
    #[serde(rename = "sundayrec")]
    SundayRec,
    #[serde(rename = "sundaystage")]
    SundayStage,
    #[serde(rename = "sundayplan")]
    SundayPlan,
    #[serde(rename = "sundaysong")]
    SundaySong,
    #[serde(rename = "sundayedit")]
    SundayEdit,
    #[serde(rename = "sundaystudio")]
    SundayStudio,
    #[serde(rename = "sundaypaper")]
    SundayPaper,
}

/// The Supabase Realtime channel a live service broadcasts on. Mirrors the
/// TypeScript `liveChannel`.
pub fn live_channel(church_id: &str, service_id: &str) -> String {
    format!("church:{church_id}:service:{service_id}")
}

/// Raised when a deep-link URL fails to parse.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractError(pub String);

impl std::fmt::Display for ContractError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ContractError {}
