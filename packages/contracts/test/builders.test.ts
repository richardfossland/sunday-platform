import { describe, expect, it } from "vitest";

import {
  buildRecordingManifest,
  buildServicePlan,
  buildUsageEvent,
  extractRecordingSegments,
  extractScriptureRefs,
  extractSongRefs,
  hadReconnect,
  liveCueEvent,
  makeUsageIdempotencyKey,
  normalizeServiceItemKind,
  nowPlayingEvent,
  RECORDING_MANIFEST_VERSION,
  RecordingManifest,
  SCHEMA_VERSION,
  ServicePlan,
  SongRef,
  totalRecordedSeconds,
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

describe("buildRecordingManifest", () => {
  // The loose Rec-internal shape that rebuilds the recording_manifest.json fixture.
  const base = {
    sessionId: "sess-1",
    serviceId: "33333333-3333-3333-3333-333333333333",
    churchId: "11111111-1111-1111-1111-111111111111",
    startedAt: "2026-05-31T09:00:00Z",
    endedAt: "2026-05-31T10:05:00Z",
    deviceLabel: "USB Mixer",
    hadPreroll: true,
    isComplete: true,
    segments: [
      {
        index: 0,
        relPath: "media/part1.mov",
        kind: "video" as const,
        startedAt: "2026-05-31T09:00:00Z",
        durationSec: 1800,
        container: "mov",
        byteSize: 1048576,
        reconnectFragments: 1,
      },
      {
        index: 1,
        relPath: "media/part2.mov",
        kind: "video" as const,
        startedAt: "2026-05-31T09:30:00Z",
        durationSec: 1100,
        container: "mov",
        reconnectFragments: 3,
      },
    ],
  };

  it("rebuilds the golden fixture from the loose input", () => {
    const m = buildRecordingManifest(base);
    expect(RecordingManifest.parse(m)).toEqual(m);
    expect(m).toEqual(loadFixture("recording_manifest.json"));
    expect(m.schema_version).toBe(SCHEMA_VERSION);
    expect(m.manifest_version).toBe(RECORDING_MANIFEST_VERSION);
  });

  it("is idempotent — same input yields byte-identical output", () => {
    expect(buildRecordingManifest(base)).toEqual(buildRecordingManifest(base));
  });

  it("derives reconnect and total-duration facts from the segments", () => {
    const m = buildRecordingManifest(base);
    expect(totalRecordedSeconds(m)).toBe(2900);
    expect(hadReconnect(m)).toBe(true);
  });

  it("sorts segments by index regardless of input order", () => {
    const shuffled = { ...base, segments: [base.segments[1], base.segments[0]] };
    const m = buildRecordingManifest(shuffled);
    expect(m.segments.map((s) => s.index)).toEqual([0, 1]);
  });

  it("handles the empty-segment, null-church edge case", () => {
    const m = buildRecordingManifest({
      sessionId: "sess-2",
      serviceId: null,
      churchId: null,
      startedAt: "2026-05-31T09:00:00Z",
      segments: [],
    });
    expect(m.church_id).toBeNull();
    expect(m.service_id).toBeNull();
    expect(m.ended_at).toBeNull();
    expect(m.had_preroll).toBe(false);
    expect(m.is_complete).toBe(false);
    expect(totalRecordedSeconds(m)).toBe(0);
    expect(hadReconnect(m)).toBe(false);
  });

  it("defaults a segment's reconnect_fragments to 1 and optionals to null", () => {
    const m = buildRecordingManifest({
      sessionId: "sess-3",
      startedAt: "2026-05-31T09:00:00Z",
      segments: [{ index: 0, relPath: "a.wav", kind: "audio", startedAt: "2026-05-31T09:00:00Z" }],
    });
    const seg = m.segments[0];
    expect(seg.reconnect_fragments).toBe(1);
    expect(seg.duration_sec).toBeNull();
    expect(seg.container).toBeNull();
    expect(seg.content_hash).toBeNull();
    expect(seg.byte_size).toBeNull();
  });
});

describe("buildServicePlan", () => {
  // The loose Plan-internal shape that rebuilds the service_plan.json fixture.
  const base = {
    serviceId: "33333333-3333-3333-3333-333333333333",
    churchId: "11111111-1111-1111-1111-111111111111",
    name: "Sunday Morning",
    startsAt: "2026-05-31T09:00:00Z",
    state: "published" as const,
    wasStreamed: true,
    items: [
      { position: 0, kind: "welcome", title: "Welcome & notices", durationMin: 3 },
      {
        position: 1,
        kind: "song",
        title: "Amazing Grace",
        songRef: {
          sundaysong_id: "22222222-2222-2222-2222-222222222222",
          local_id: "song-local-7",
          title: "Amazing Grace",
          ccli_song_id: "22025",
          tono_work_id: null,
          default_key: "G",
          language: "en",
        },
        keyOverride: "A",
        durationMin: 5,
        notes: "Capo 2",
      },
      {
        position: 2,
        kind: "scripture",
        title: "Reading",
        scriptureRef: "John 3:16-21",
        durationMin: 2,
      },
    ],
  };

  it("rebuilds the golden fixture from the loose input", () => {
    const p = buildServicePlan(base);
    expect(ServicePlan.parse(p)).toEqual(p);
    expect(p).toEqual(loadFixture("service_plan.json"));
    expect(p.schema_version).toBe(SCHEMA_VERSION);
    expect(p.service.schema_version).toBe(SCHEMA_VERSION);
  });

  it("is idempotent — same input yields byte-identical output", () => {
    expect(buildServicePlan(base)).toEqual(buildServicePlan(base));
  });

  it("sorts items by position regardless of input order", () => {
    const shuffled = { ...base, items: [base.items[2], base.items[0], base.items[1]] };
    const p = buildServicePlan(shuffled);
    expect(p.items.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it("degrades an unknown item kind to custom rather than throwing", () => {
    const p = buildServicePlan({
      ...base,
      items: [{ position: 0, kind: "liturgy_chant", title: "Kyrie" }],
    });
    expect(p.items[0].kind).toBe("custom");
  });

  it("handles the empty-items edge case", () => {
    const p = buildServicePlan({ ...base, items: [] });
    expect(p.items).toEqual([]);
    expect(p.service.notes).toBeNull();
  });
});

describe("normalizeServiceItemKind", () => {
  it("passes through a canonical kind", () => {
    expect(normalizeServiceItemKind("song")).toBe("song");
    expect(normalizeServiceItemKind("scripture")).toBe("scripture");
  });

  it("maps an unknown kind to custom", () => {
    expect(normalizeServiceItemKind("liturgy_chant")).toBe("custom");
    expect(normalizeServiceItemKind("")).toBe("custom");
  });
});

describe("variant extractors", () => {
  const plan = buildServicePlan({
    serviceId: "33333333-3333-3333-3333-333333333333",
    churchId: "11111111-1111-1111-1111-111111111111",
    name: "Sunday Morning",
    startsAt: "2026-05-31T09:00:00Z",
    state: "published",
    wasStreamed: true,
    items: [
      {
        position: 2,
        kind: "song",
        songRef: { ...SongRef.parse(loadFixture("song_ref.json")), title: "Second song" },
      },
      { position: 0, kind: "scripture", scriptureRef: "John 1:1-5" },
      {
        position: 1,
        kind: "song",
        songRef: { ...SongRef.parse(loadFixture("song_ref.json")), title: "First song" },
      },
    ],
  });

  it("extracts song refs in running order, skipping non-songs", () => {
    const refs = extractSongRefs(plan);
    expect(refs.map((r) => r.title)).toEqual(["First song", "Second song"]);
  });

  it("extracts scripture refs in running order", () => {
    expect(extractScriptureRefs(plan)).toEqual(["John 1:1-5"]);
  });

  it("returns an empty array when nothing matches", () => {
    const empty = buildServicePlan({
      serviceId: "33333333-3333-3333-3333-333333333333",
      churchId: "11111111-1111-1111-1111-111111111111",
      name: "Empty",
      startsAt: "2026-05-31T09:00:00Z",
      state: "draft",
      wasStreamed: false,
      items: [{ position: 0, kind: "welcome" }],
    });
    expect(extractSongRefs(empty)).toEqual([]);
    expect(extractScriptureRefs(empty)).toEqual([]);
  });

  it("extracts recording segments in index order", () => {
    const manifest = buildRecordingManifest({
      sessionId: "sess-1",
      startedAt: "2026-05-31T09:00:00Z",
      segments: [
        { index: 1, relPath: "b.mov", kind: "video", startedAt: "2026-05-31T09:30:00Z" },
        { index: 0, relPath: "a.mov", kind: "video", startedAt: "2026-05-31T09:00:00Z" },
      ],
    });
    expect(extractRecordingSegments(manifest).map((s) => s.rel_path)).toEqual([
      "a.mov",
      "b.mov",
    ]);
  });
});
