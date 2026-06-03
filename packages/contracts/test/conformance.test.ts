import { describe, expect, it } from "vitest";

import {
  LiveEvent,
  RecordingManifest,
  ServicePlan,
  SongRef,
  SundayBundle,
  UsageEvent,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

/**
 * Each golden fixture must parse and round-trip unchanged. The Rust crate's
 * `conformance.rs` reads the SAME files — if the two languages ever disagree on a
 * shape, one of these (or its Rust twin) fails.
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
