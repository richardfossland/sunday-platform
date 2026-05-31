import { describe, expect, it } from "vitest";

import {
  buildUsageEvent,
  liveCueEvent,
  makeUsageIdempotencyKey,
  nowPlayingEvent,
  SCHEMA_VERSION,
  SongRef,
  UsageEvent,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

describe("buildUsageEvent", () => {
  const base = {
    churchId: "11111111-1111-1111-1111-111111111111",
    songId: "22222222-2222-2222-2222-222222222222",
    serviceDate: "2026-05-31",
    wasStreamed: true,
    serviceId: "svc-9",
    serviceItemId: "1",
  };

  it("builds a valid UsageEvent with the derived idempotency key", () => {
    const e = buildUsageEvent(base);
    expect(UsageEvent.parse(e)).toEqual(e);
    expect(e.idempotency_key).toBe(makeUsageIdempotencyKey("svc-9", "1"));
    expect(e.schema_version).toBe(SCHEMA_VERSION);
    expect(e.variant_id).toBeNull();
    expect(e.duration_displayed_sec).toBeNull();
    expect(e.was_streamed).toBe(true);
  });

  it("is stable across re-sends of the same service item", () => {
    expect(buildUsageEvent(base).idempotency_key).toBe(
      buildUsageEvent({ ...base, wasStreamed: false }).idempotency_key,
    );
  });

  it("carries optional variant and duration", () => {
    const e = buildUsageEvent({
      ...base,
      variantId: "44444444-4444-4444-4444-444444444444",
      durationDisplayedSec: 312,
    });
    expect(e.variant_id).toBe("44444444-4444-4444-4444-444444444444");
    expect(e.duration_displayed_sec).toBe(312);
  });
});

describe("liveCueEvent", () => {
  it("builds a cue.advanced signal with the given sequence", () => {
    const e = liveCueEvent(
      { serviceId: "33333333-3333-3333-3333-333333333333", sequence: 5, emittedAt: "2026-05-31T09:01:00Z" },
      { itemId: "item-2", itemPosition: 2, label: "Verse 1", slideIndex: 0 },
    );
    expect(e.type).toBe("cue.advanced");
    expect(e.sequence).toBe(5);
    expect(e.label).toBe("Verse 1");
    expect(e.slide_index).toBe(0);
  });

  it("defaults cue fields to null", () => {
    const e = liveCueEvent({ serviceId: "33333333-3333-3333-3333-333333333333", sequence: 0, emittedAt: "2026-05-31T09:00:00Z" });
    expect(e.item_id).toBeNull();
    expect(e.label).toBeNull();
  });
});

describe("nowPlayingEvent", () => {
  it("builds a now_playing signal carrying a SongRef", () => {
    const song = SongRef.parse(loadFixture("song_ref.json"));
    const e = nowPlayingEvent(
      { serviceId: "33333333-3333-3333-3333-333333333333", sequence: 6, emittedAt: "2026-05-31T09:02:00Z" },
      { songRef: song, itemPosition: 1, title: "Amazing Grace" },
    );
    expect(e.type).toBe("now_playing");
    expect(e.sequence).toBe(6);
    expect(e.song_ref).toEqual(song);
    expect(e.title).toBe("Amazing Grace");
  });

  it("defaults song fields to null", () => {
    const e = nowPlayingEvent({ serviceId: "33333333-3333-3333-3333-333333333333", sequence: 1, emittedAt: "2026-05-31T09:00:00Z" });
    expect(e.song_ref).toBeNull();
    expect(e.item_position).toBeNull();
  });
});
