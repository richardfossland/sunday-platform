import { describe, expect, it, vi } from "vitest";

import { buildUsageEvent, SundayCloudClient } from "../src/index.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: { "Content-Type": "text/csv" } });
}

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";

describe("SundayCloudClient.songs", () => {
  it("search builds a query string and skips omitted params", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, { hits: [], page: 1, page_size: 20, total: 0 }),
    );
    const client = new SundayCloudClient({ baseUrl: "https://api.test", fetch });

    await client.songs.search({ q: "amazing grace", language: "en" });

    const url = fetch.mock.calls[0]![0] as string;
    expect(url).toBe("https://api.test/v1/songs/search?q=amazing+grace&language=en");
  });

  it("get encodes the id into the path", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { id: "a/b" }));
    const client = new SundayCloudClient({ baseUrl: "https://api.test", fetch });
    await client.songs.get("a/b");
    expect(fetch.mock.calls[0]![0]).toBe("https://api.test/v1/songs/a%2Fb");
  });
});

describe("SundayCloudClient.usage", () => {
  it("logs a contracts-built UsageEvent to /v1/usage/log", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, { ok: true, idempotency_key: "svc-s1:item-i1", logged: true }),
    );
    const client = new SundayCloudClient({ baseUrl: "https://api.test", fetch });

    const event = buildUsageEvent({
      churchId: UUID_A,
      songId: UUID_B,
      serviceDate: "2026-05-31",
      wasStreamed: true,
      serviceId: "s1",
      serviceItemId: "i1",
    });
    const res = await client.usage.log(event);

    expect(res.logged).toBe(true);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.test/v1/usage/log");
    expect(init?.method).toBe("POST");
    // The wire body carries the deterministic idempotency key from contracts.
    const sent = JSON.parse(init!.body as string) as { idempotency_key: string; was_streamed: boolean };
    expect(sent.idempotency_key).toBe("svc-s1:item-i1");
    expect(sent.was_streamed).toBe(true);
  });
});

describe("SundayCloudClient.licensing", () => {
  it("report posts the period body", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, { church_id: UUID_A, from: "2026-01-01", to: "2026-03-31", ccli: [], tono: [] }),
    );
    const client = new SundayCloudClient({ baseUrl: "https://api.test", fetch });

    const report = await client.licensing.report({ church_id: UUID_A, from: "2026-01-01", to: "2026-03-31" });

    expect(report.church_id).toBe(UUID_A);
    expect(fetch.mock.calls[0]![0]).toBe("https://api.test/v1/licensing/report");
  });

  it("reportCsv puts the system in the query and the period in the body, returning raw text", async () => {
    const fetch = vi.fn(async () => textResponse(200, "song,plays\nAmazing Grace,3\n"));
    const client = new SundayCloudClient({ baseUrl: "https://api.test", fetch });

    const csv = await client.licensing.reportCsv({
      church_id: UUID_A,
      from: "2026-01-01",
      to: "2026-03-31",
      system: "tono",
    });

    expect(csv).toContain("Amazing Grace,3");
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.test/v1/licensing/report.csv?system=tono");
    // `system` must NOT be duplicated into the body.
    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    expect(body).toEqual({ church_id: UUID_A, from: "2026-01-01", to: "2026-03-31" });
  });

  it("coverage posts song + profile", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, { ccli: "covered", tono: "unknown", warnings: ["Check TONO."] }),
    );
    const client = new SundayCloudClient({ baseUrl: "https://api.test", fetch });

    const cov = await client.licensing.coverage({
      song: { title: "Amazing Grace", ccli_song_id: "22025", tono_work_id: null },
      profile: { has_ccli: true, has_tono: false },
    });

    expect(cov.ccli).toBe("covered");
    expect(cov.warnings).toContain("Check TONO.");
  });
});

describe("SundayCloudClient.sources", () => {
  it("lists sources", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, { sources: [{ id: "salmebok", name: "Norsk Salmebok", variant_count: 899 }] }),
    );
    const client = new SundayCloudClient({ baseUrl: "https://api.test", fetch });
    const out = await client.sources.list();
    expect(out.sources[0]!.variant_count).toBe(899);
    expect(fetch.mock.calls[0]![0]).toBe("https://api.test/v1/sources");
  });
});
