use serde::{Deserialize, Serialize};

/// A cross-app reference to a song — canonical SundaySong id (when linked) plus
/// the originating app's local id and the licensing identifiers every Sunday
/// song table already holds. A reference + snapshot, never full lyrics.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SongRef {
    pub sundaysong_id: Option<String>,
    pub local_id: Option<String>,
    pub title: String,
    pub ccli_song_id: Option<String>,
    pub tono_work_id: Option<String>,
    pub default_key: Option<String>,
    pub language: String,
}
