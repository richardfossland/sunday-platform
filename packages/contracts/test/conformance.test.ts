import { describe, expect, it } from "vitest";

import {
  LiveEvent,
  makeUsageIdempotencyKey,
  readBundle,
  RecordingManifest,
  ServicePlan,
  SongRef,
  SundayBundle,
  UsageEvent,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

/**
 * Each golden fixture must parse and round-trip unchanged. The Rust crate's
 * `conformance.rs` reads the SAME files from the repo-root `fixtures/` dir — if
 * the two languages ever disagree on a shape, one of these (or its Rust twin)
 * fails. The `media_handoff.json` and `deeplink_urls.json` shapes are exercised
 * cross-language too, but on the TS side they live in `deeplink.test.ts` (the
 * Rust suite covers them inline here). This file owns the contract shapes below
 * plus the two cross-app event streams.
 */
describe("golden fixture round-trips", () => {
  const cases: Array<{
    file: string;
    schema: { parse: (v: unknown) => unknown };
  }> = [
    { file: "song_ref.json", schema: SongRef },
    { file: "usage_event.json", schema: UsageEvent },
    { file: "service_plan.json", schema: ServicePlan },
    { file: "sunday_bundle.json", schema: SundayBundle },
    { file: "live_cue.json", schema: LiveEvent },
    { file: "live_now_playing.json", schema: LiveEvent },
    { file: "live_service.json", schema: LiveEvent },
    { file: "live_service_ended.json", schema: LiveEvent },
    { file: "recording_manifest.json", schema: RecordingManifest },
  ];

  for (const { file, schema } of cases) {
    it(`${file} parses and round-trips`, () => {
      const raw = loadFixture(file);
      const parsed = schema.parse(raw);
      expect(parsed).toEqual(raw);
    });
  }
});

describe("LiveEvent discrimination", () => {
  it("routes each fixture to its variant", () => {
    expect(
      (LiveEvent.parse(loadFixture("live_cue.json")) as { type: string }).type,
    ).toBe("cue.advanced");
    expect(
      (
        LiveEvent.parse(loadFixture("live_now_playing.json")) as {
          type: string;
        }
      ).type,
    ).toBe("now_playing");
    expect(
      (LiveEvent.parse(loadFixture("live_service.json")) as { type: string })
        .type,
    ).toBe("service.live");
  });
});

describe("schema_version defaulting", () => {
  it("fills schema_version when omitted", () => {
    const raw = loadFixture<Record<string, unknown>>("usage_event.json");
    delete raw.schema_version;
    const parsed = UsageEvent.parse(raw) as { schema_version: number };
    expect(parsed.schema_version).toBe(1);
  });
});

/**
 * Forward-compatibility: a payload from a NEWER app (higher schema_version) must
 * still parse on an older TS consumer, exactly as it does in Rust (a `u32`, whose
 * `2^32 - 1` ceiling both languages share). The docs promise "an old SundayStage must keep talking to a new
 * SundaySong" and "Unknown fields are ignored (forward-compatible)". A hard
 * `z.literal(1)` would split-brain the offline import trust boundary: Rust
 * accepts the future bundle/event, TS rejects it.
 */
describe("schema_version forward-compatibility (cross-language parity with Rust u32)", () => {
  it("UsageEvent accepts a future schema_version", () => {
    const raw = loadFixture<Record<string, unknown>>("usage_event.json");
    raw.schema_version = 2;
    const parsed = UsageEvent.parse(raw) as { schema_version: number };
    expect(parsed.schema_version).toBe(2);
  });

  it("RecordingManifest accepts a future schema_version", () => {
    const raw = loadFixture<Record<string, unknown>>("recording_manifest.json");
    raw.schema_version = 7;
    const parsed = RecordingManifest.parse(raw) as { schema_version: number };
    expect(parsed.schema_version).toBe(7);
  });

  it("readBundle accepts a future schema_version (.sundaybundle offline import)", () => {
    const raw = loadFixture<Record<string, unknown>>("sunday_bundle.json");
    raw.schema_version = 99;
    const result = readBundle(JSON.stringify(raw));
    expect(result.errors).toEqual([]);
    expect(result.bundle?.schema_version).toBe(99);
  });

  it("still rejects a non-version schema_version (0 / negative / non-int)", () => {
    const raw = loadFixture<Record<string, unknown>>("usage_event.json");
    raw.schema_version = 0;
    expect(UsageEvent.safeParse(raw).success).toBe(false);
    raw.schema_version = -1;
    expect(UsageEvent.safeParse(raw).success).toBe(false);
    raw.schema_version = 1.5;
    expect(UsageEvent.safeParse(raw).success).toBe(false);
  });

  it("accepts the u32::MAX boundary but rejects one past it (parity with Rust u32)", () => {
    const U32_MAX = 0xffff_ffff; // 4_294_967_295 — the largest a Rust u32 holds.
    const raw = loadFixture<Record<string, unknown>>("sunday_bundle.json");
    raw.schema_version = U32_MAX;
    const ok = readBundle(JSON.stringify(raw));
    expect(ok.errors).toEqual([]);
    expect(ok.bundle?.schema_version).toBe(U32_MAX);

    raw.schema_version = U32_MAX + 1;
    const tooBig = readBundle(JSON.stringify(raw));
    expect(tooBig.bundle).toBeFalsy();
    expect(tooBig.errors.length).toBeGreaterThan(0);
  });
});

/**
 * Shape edge cases that the round-trip cases above don't reach because the
 * golden fixtures hold the "happy" shape. Each is derived from a golden fixture
 * and mirrored 1:1 in the Rust `conformance.rs` so the two languages agree on
 * the boundary, not just the center.
 */
describe("contract shape edge cases (cross-language parity with Rust)", () => {
  it("a ServicePlan with zero items round-trips (placeholder service)", () => {
    const raw = loadFixture<Record<string, unknown>>("service_plan.json");
    raw.items = [];
    const parsed = ServicePlan.parse(raw) as { items: unknown[] };
    expect(parsed.items).toEqual([]);
    expect(parsed).toEqual(raw);
  });

  it("an in-progress RecordingManifest (null ended_at) round-trips", () => {
    const raw = loadFixture<Record<string, unknown>>("recording_manifest.json");
    raw.ended_at = null;
    raw.is_complete = false;
    const parsed = RecordingManifest.parse(raw) as {
      ended_at: string | null;
      is_complete: boolean;
    };
    expect(parsed.ended_at).toBeNull();
    expect(parsed.is_complete).toBe(false);
    expect(parsed).toEqual(raw);
  });
});

/**
 * Nullable-field parity: Rust's `Option<T>` treats a MISSING key as `None`. The
 * TS contracts must do the same (omitted nullable key -> null), or a hand-written
 * / third-party `.sundaybundle` or manifest that omits a None field parses in
 * Rust but is rejected by the TS consumer — another split-brain at the offline
 * trust boundary. (Plain Zod `.nullable()` requires the key to be present.)
 */
describe("nullable fields tolerate an omitted key (cross-language parity with Rust Option)", () => {
  it("RecordingManifest parses with a nullable key omitted -> null", () => {
    const raw = loadFixture<Record<string, unknown>>("recording_manifest.json");
    delete raw.device_label;
    const result = RecordingManifest.safeParse(raw);
    expect(result.success).toBe(true);
    expect(
      (result.data as { device_label: string | null }).device_label,
    ).toBeNull();
  });

  it("readBundle parses with a nullable key omitted -> null", () => {
    const raw = loadFixture<Record<string, unknown>>("sunday_bundle.json");
    delete raw.church_id;
    const result = readBundle(JSON.stringify(raw));
    expect(result.errors).toEqual([]);
    expect(result.bundle?.church_id).toBeNull();
  });

  it("UsageEvent parses with a nullable key omitted -> null", () => {
    const raw = loadFixture<Record<string, unknown>>("usage_event.json");
    delete raw.variant_id;
    const result = UsageEvent.safeParse(raw);
    expect(result.success).toBe(true);
    expect(
      (result.data as { variant_id: string | null }).variant_id,
    ).toBeNull();
  });
});

/** The cross-app golden streams wrap their events in
 * `{ description, service_id, events: [...] }`. */
interface EventStream {
  service_id: string;
  events: unknown[];
}

const SERVICE_ID = "33333333-3333-3333-3333-333333333333";

describe("Stage->Rec golden cue stream", () => {
  it("every event round-trips as a LiveEvent for the one service", () => {
    const { events } = loadFixture<EventStream>("stage-to-rec-cues.json");
    expect(events.length).toBeGreaterThan(0);
    for (const raw of events) {
      const parsed = LiveEvent.parse(raw);
      expect(parsed).toEqual(raw);
      expect((parsed as { service_id: string }).service_id).toBe(SERVICE_ID);
    }
  });

  it("sequence is strictly monotonic (the contract's ordering/de-dup key)", () => {
    const { events } = loadFixture<EventStream>("stage-to-rec-cues.json");
    const seqs = events.map(
      (raw) => (LiveEvent.parse(raw) as { sequence: number }).sequence,
    );
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    }
  });
});

describe("Stage->Song golden usage stream", () => {
  it("every event round-trips as a UsageEvent", () => {
    const { events } = loadFixture<EventStream>("stage-to-song-usage.json");
    expect(events.length).toBeGreaterThan(0);
    for (const raw of events) {
      const parsed = UsageEvent.parse(raw);
      expect(parsed).toEqual(raw);
    }
  });

  it("each idempotency_key matches the contract formula and is unique per item", () => {
    const { events } = loadFixture<EventStream>("stage-to-song-usage.json");
    // One usage event per service item, in advance order.
    const serviceItemIds = ["item-a", "item-b"];
    const seen = new Set<string>();
    events.forEach((raw, i) => {
      const parsed = UsageEvent.parse(raw) as { idempotency_key: string };
      expect(parsed.idempotency_key).toBe(
        makeUsageIdempotencyKey(SERVICE_ID, serviceItemIds[i]),
      );
      expect(seen.has(parsed.idempotency_key)).toBe(false);
      seen.add(parsed.idempotency_key);
    });
  });
});
