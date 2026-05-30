import { z } from "zod";

/**
 * A cross-app reference to a song. Carries both the canonical SundaySong id
 * (when known) and the originating app's local id, plus the licensing identifiers
 * (`ccli_song_id`, `tono_work_id`) that every Sunday song table already holds.
 * This is a *reference + snapshot*, not the full song — lyrics live in their
 * authoritative store (we never copy content we can't host).
 */
export const SongRef = z.object({
  /** Canonical SundaySong catalog id, or null if not yet linked. */
  sundaysong_id: z.string().uuid().nullable(),
  /** The originating app's own row id (Stage/Plan local song), or null. */
  local_id: z.string().nullable(),
  title: z.string().min(1).max(300),
  ccli_song_id: z.string().nullable(),
  tono_work_id: z.string().nullable(),
  default_key: z.string().max(8).nullable(),
  language: z.string().min(2).max(8),
});
export type SongRef = z.infer<typeof SongRef>;
