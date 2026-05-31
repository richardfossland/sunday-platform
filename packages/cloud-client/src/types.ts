/**
 * Wire shapes for the parts of the Sunday API surface that `@sunday/contracts`
 * does not yet own. These mirror the SundaySong `/v1/*` request/response bodies
 * (the SDK's `@sundaysong/shared` types); we re-declare the minimal shapes here
 * rather than path-depend on that app's package, and converge once the relevant
 * shapes graduate into `@sunday/contracts`.
 *
 * Where a shape DOES already live in `@sunday/contracts` (usage events, song
 * references), the client reuses it directly instead of duplicating here.
 */

/** Params for `GET /v1/songs/search`. */
export interface SongSearchParams {
  q: string;
  language?: string;
  page?: number;
  page_size?: number;
}

/** One row of a search result list. Forward-compatible: ignore unknown fields. */
export interface SongSearchHit {
  song_id: string;
  variant_id: string | null;
  title: string;
  language: string;
  ccli_song_id: string | null;
  tono_work_id: string | null;
  default_key: string | null;
  /** Relevance score, when the backend provides one. */
  score?: number;
}

/** A page of search hits. */
export interface SongSearchResult {
  hits: SongSearchHit[];
  page: number;
  page_size: number;
  total: number;
}

/** A licensor system the suite reports to. */
export type LicensingSystem = "ccli" | "tono";

/** Request body for `POST /v1/licensing/report` and `…/report.csv`. */
export interface LicensingReportInput {
  church_id: string;
  /** ISO calendar date YYYY-MM-DD (inclusive start). */
  from: string;
  /** ISO calendar date YYYY-MM-DD (inclusive end). */
  to: string;
}

/** One reported usage line in a licensing report. */
export interface LicensingReportLine {
  song_id: string;
  title: string;
  ccli_song_id: string | null;
  tono_work_id: string | null;
  /** How many times the song was displayed in the period. */
  plays: number;
  /** Of those, how many were streamed (feed a different royalty pool). */
  streamed_plays: number;
}

/** A CCLI + TONO licensing report for one church and period. */
export interface LicensingReport {
  church_id: string;
  from: string;
  to: string;
  ccli: LicensingReportLine[];
  tono: LicensingReportLine[];
}

/** Request body for `POST /v1/licensing/coverage`. */
export interface CoverageInput {
  /** The song to assess (identifiers the caller already holds). */
  song: {
    title: string;
    ccli_song_id?: string | null;
    tono_work_id?: string | null;
    language?: string;
  };
  /** The church's licensing profile (which licenses they hold). */
  profile: {
    has_ccli?: boolean;
    has_tono?: boolean;
  };
}

/** Per-song CCLI/TONO coverage for the "✓ CCLI + TONO" / "⚠ Check TONO" pill. */
export interface CoverageResult {
  ccli: "covered" | "not_covered" | "unknown";
  tono: "covered" | "not_covered" | "unknown";
  /** Human-readable gray areas a person should double-check. */
  warnings: string[];
}

/** The data sources the catalog indexes, with per-source variant counts. */
export interface SourceSummary {
  id: string;
  name: string;
  variant_count: number;
}
