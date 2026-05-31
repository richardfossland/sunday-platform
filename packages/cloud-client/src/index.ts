/**
 * @sunday/cloud-client — a thin, suite-level typed client to the Sunday API.
 *
 * Wraps the SundaySong `/v1/*` surface (song search, usage logging, CCLI/TONO
 * licensing reporting, sources) as pure request shaping over an *injected*
 * `fetch`, with responses typed against `@sunday/contracts` where the contract
 * owns the shape and a local mirror (`./types`) for the rest. No app-specific
 * dependencies — any Sunday app can compose it.
 *
 * Live calls perform real network I/O and are NETWORK-UNVERIFIED; the unit
 * tests drive every method through a mock fetch (no network required).
 *
 * Re-exports the canonical `UsageEvent` + `buildUsageEvent` from
 * `@sunday/contracts` so a caller has a single import for "build a usage event
 * and log it".
 */
export { SundayCloudClient } from "./client.js";
export { SundayCloudError } from "./errors.js";
export {
  CloudTransport,
  backoffMs,
  buildQuery,
  isRetryable,
  type CloudClientConfig,
} from "./http.js";
export type {
  CoverageInput,
  CoverageResult,
  LicensingReport,
  LicensingReportInput,
  LicensingReportLine,
  LicensingSystem,
  SongSearchHit,
  SongSearchParams,
  SongSearchResult,
  SourceSummary,
} from "./types.js";

// Convenience re-exports: build a usage event then log it without a second import.
export { buildUsageEvent, makeUsageIdempotencyKey, type UsageEvent } from "@sunday/contracts";
