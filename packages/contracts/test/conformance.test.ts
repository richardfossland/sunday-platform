import { describe, expect, it } from "vitest";

import {
  LiveEvent,
  makeUsageIdempotencyKey,
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
  const cases: Array<{ file: string; schema: { parse: (v: unknown) => unknown } }> = [
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
    expect((LiveEvent.parse(loadFixture("live_cue.json")) as { type: string }).type).toBe(
      "cue.advanced",
    );
    expect(
      (LiveEvent.parse(loadFixture("live_now_playing.json")) as { type: string }).type,
    ).toBe("now_playing");
    expect((LiveEvent.parse(loadFixture("live_service.json")) as { type: string }).type).toBe(
      "service.live",
    );
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
    const seqs = events.map((raw) => (LiveEvent.parse(raw) as { sequence: number }).sequence);
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
      expect(parsed.idempotency_key).toBe(makeUsageIdempotencyKey(SERVICE_ID, serviceItemIds[i]));
      expect(seen.has(parsed.idempotency_key)).toBe(false);
      seen.add(parsed.idempotency_key);
    });
  });
});
