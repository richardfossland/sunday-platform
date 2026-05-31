import { describe, expect, it } from "vitest";

import {
  hadReconnect,
  RECORDING_MANIFEST_VERSION,
  RecordingManifest,
  totalRecordedSeconds,
} from "../src/index.js";

function sampleManifest() {
  return {
    schema_version: 1,
    manifest_version: RECORDING_MANIFEST_VERSION,
    session_id: "sess-1",
    service_id: "33333333-3333-3333-3333-333333333333",
    church_id: "11111111-1111-1111-1111-111111111111",
    started_at: "2026-05-31T09:00:00Z",
    ended_at: "2026-05-31T10:05:00Z",
    device_label: "USB Mixer",
    had_preroll: true,
    is_complete: true,
    segments: [
      {
        index: 0,
        rel_path: "media/part1.mov",
        kind: "video",
        started_at: "2026-05-31T09:00:00Z",
        duration_sec: 1800,
        container: "mov",
        content_hash: null,
        byte_size: 1048576,
        reconnect_fragments: 1,
      },
      {
        index: 1,
        rel_path: "media/part2.mov",
        kind: "video",
        started_at: "2026-05-31T09:30:00Z",
        duration_sec: 1100,
        container: "mov",
        content_hash: null,
        byte_size: null,
        reconnect_fragments: 3,
      },
    ],
  };
}

describe("RecordingManifest", () => {
  it("parses and round-trips a full manifest", () => {
    const raw = sampleManifest();
    expect(RecordingManifest.parse(raw)).toEqual(raw);
  });

  it("defaults schema_version when omitted", () => {
    const raw = sampleManifest() as Record<string, unknown>;
    delete raw.schema_version;
    expect(
      (RecordingManifest.parse(raw) as { schema_version: number })
        .schema_version,
    ).toBe(1);
  });

  it("sums recorded seconds, treating unknown durations as 0", () => {
    const m = RecordingManifest.parse(sampleManifest());
    expect(totalRecordedSeconds(m)).toBe(2900);
    const m2 = RecordingManifest.parse({
      ...sampleManifest(),
      segments: [{ ...sampleManifest().segments[0]!, duration_sec: null }],
    });
    expect(totalRecordedSeconds(m2)).toBe(0);
  });

  it("flags reconnect when any segment stitched >1 fragment", () => {
    expect(hadReconnect(RecordingManifest.parse(sampleManifest()))).toBe(true);
    const clean = RecordingManifest.parse({
      ...sampleManifest(),
      segments: [{ ...sampleManifest().segments[0]!, reconnect_fragments: 1 }],
    });
    expect(hadReconnect(clean)).toBe(false);
  });
});
