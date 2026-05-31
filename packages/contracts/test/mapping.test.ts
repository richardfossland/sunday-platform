import { describe, expect, it } from "vitest";

import {
  ServiceItemKind,
  serviceItemKindFromPlan,
  serviceItemKindFromStage,
  serviceItemKindToStage,
} from "../src/index.js";

const STAGE_KINDS = [
  "song",
  "scripture",
  "custom_deck",
  "video",
  "announcement",
  "gap",
] as const;

describe("Plan → canonical", () => {
  it("maps each Plan kind to a valid canonical kind", () => {
    const planKinds = [
      "welcome",
      "worship_set",
      "song",
      "scripture",
      "sermon",
      "response",
      "closing",
      "announcement",
      "gap",
    ];
    for (const k of planKinds) {
      // Every result must be a real canonical kind.
      expect(ServiceItemKind.options).toContain(serviceItemKindFromPlan(k));
    }
    expect(serviceItemKindFromPlan("worship_set")).toBe("song");
    expect(serviceItemKindFromPlan("closing")).toBe("custom");
  });

  it("unknown Plan kind degrades to custom", () => {
    expect(serviceItemKindFromPlan("liturgical_dance")).toBe("custom");
  });
});

describe("Stage → canonical", () => {
  it("maps each Stage kind to a valid canonical kind", () => {
    for (const k of STAGE_KINDS) {
      expect(ServiceItemKind.options).toContain(serviceItemKindFromStage(k));
    }
    expect(serviceItemKindFromStage("custom_deck")).toBe("custom");
    expect(serviceItemKindFromStage("video")).toBe("media");
  });

  it("unknown Stage kind degrades to custom", () => {
    expect(serviceItemKindFromStage("hologram")).toBe("custom");
  });
});

describe("canonical → Stage", () => {
  it("maps every canonical kind to a valid Stage kind", () => {
    for (const k of ServiceItemKind.options) {
      expect(STAGE_KINDS).toContain(serviceItemKindToStage(k));
    }
    expect(serviceItemKindToStage("song")).toBe("song");
    expect(serviceItemKindToStage("media")).toBe("video");
    expect(serviceItemKindToStage("sermon")).toBe("custom_deck");
  });
});

describe("round-trips that should be lossless", () => {
  it("song/scripture/announcement/gap survive Plan→canonical→Stage", () => {
    for (const [plan, stage] of [
      ["song", "song"],
      ["scripture", "scripture"],
      ["announcement", "announcement"],
      ["gap", "gap"],
    ] as const) {
      expect(serviceItemKindToStage(serviceItemKindFromPlan(plan))).toBe(stage);
    }
  });
});
