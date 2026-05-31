import type { UsageEvent } from "@sunday/contracts";

import { buildQuery, CloudTransport, type CloudClientConfig } from "./http.js";
import type {
  CoverageInput,
  CoverageResult,
  LicensingReport,
  LicensingReportInput,
  LicensingSystem,
  SongSearchParams,
  SongSearchResult,
  SourceSummary,
} from "./types.js";

/**
 * `SundayCloudClient` — the suite-level typed client to the Sunday API surface
 * (the SundaySong `/v1/*` endpoints plus the usage/licensing reporting surface).
 *
 * It is intentionally *thin*: pure request shaping over an injected `fetch`,
 * with responses typed against `@sunday/contracts` (for shapes the contract
 * owns, like {@link UsageEvent}) and the local mirror in `./types` for the rest.
 * Unlike the per-app SundaySong SDK, this client carries no app-specific deps —
 * any Sunday app can compose it.
 *
 * All methods perform real network I/O through the transport and are therefore
 * NETWORK-UNVERIFIED; the tests drive them entirely through a mock fetch.
 */
export class SundayCloudClient {
  private readonly http: CloudTransport;

  constructor(config: CloudClientConfig = {}) {
    this.http = new CloudTransport(config);
  }

  /** Full-text catalog search. `GET /v1/songs/search`. */
  readonly songs = {
    search: (params: SongSearchParams): Promise<SongSearchResult> => {
      const qs = buildQuery({
        q: params.q,
        language: params.language,
        page: params.page,
        page_size: params.page_size,
      });
      return this.http.requestJson<SongSearchResult>(`/v1/songs/search${qs}`);
    },
    /** Fetch one song by canonical id. `GET /v1/songs/:id`. */
    get: <T = unknown>(id: string): Promise<T> =>
      this.http.requestJson<T>(`/v1/songs/${encodeURIComponent(id)}`),
  };

  /**
   * Record that a song was displayed during a service. `POST /v1/usage/log`.
   * Takes the canonical {@link UsageEvent} (build it with `buildUsageEvent`
   * from `@sunday/contracts`); the API dedupes on `idempotency_key`.
   */
  readonly usage = {
    log: (event: UsageEvent): Promise<{ ok: true; idempotency_key: string; logged: boolean }> =>
      this.http.postJson("/v1/usage/log", event),
  };

  /** CCLI + TONO licensing reporting — the suite's Nordic moat. */
  readonly licensing = {
    /** `POST /v1/licensing/report` — a full CCLI + TONO report for a period. */
    report: (input: LicensingReportInput): Promise<LicensingReport> =>
      this.http.postJson<LicensingReport>("/v1/licensing/report", input),
    /** `POST /v1/licensing/report.csv` — downloadable CSV for one licensor. Returns raw CSV. */
    reportCsv: (input: LicensingReportInput & { system: LicensingSystem }): Promise<string> => {
      const { system, ...body } = input;
      return this.http.requestText(`/v1/licensing/report.csv${buildQuery({ system })}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    /** `POST /v1/licensing/coverage` — per-song CCLI/TONO pill status. */
    coverage: (input: CoverageInput): Promise<CoverageResult> =>
      this.http.postJson<CoverageResult>("/v1/licensing/coverage", input),
  };

  /** The data sources the catalog indexes. `GET /v1/sources`. */
  readonly sources = {
    list: (): Promise<{ sources: SourceSummary[] }> =>
      this.http.requestJson<{ sources: SourceSummary[] }>("/v1/sources"),
  };
}
