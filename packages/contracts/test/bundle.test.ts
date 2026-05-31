import { describe, expect, it } from "vitest";

import {
  BUNDLE_VERSION,
  readBundle,
  SCHEMA_VERSION,
  ServicePlan,
  type MediaItem,
  writeServicePlanBundle,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

describe("writeServicePlanBundle", () => {
  it("wraps a service plan in a valid envelope", () => {
    const plan = ServicePlan.parse(loadFixture("service_plan.json"));
    const bundle = writeServicePlanBundle(plan, {
      sourceApp: "sundayplan",
      churchId: "11111111-1111-1111-1111-111111111111",
      createdAt: "2026-05-31T08:00:00Z",
    });
    expect(bundle.kind).toBe("service_plan");
    expect(bundle.schema_version).toBe(SCHEMA_VERSION);
    expect(bundle.bundle_version).toBe(BUNDLE_VERSION);
    expect(bundle.source_app).toBe("sundayplan");
    expect(bundle.media).toEqual([]);
    expect(bundle.service_plan).toEqual(plan);
  });

  it("carries media by reference and a null church", () => {
    const plan = ServicePlan.parse(loadFixture("service_plan.json"));
    const media: MediaItem[] = [
      { rel_path: "media/sermon.mov", content_hash: null, byte_size: null, kind: "video" },
    ];
    const bundle = writeServicePlanBundle(plan, {
      sourceApp: "sundayrec",
      churchId: null,
      media,
      createdAt: "2026-05-31T08:00:00Z",
    });
    expect(bundle.church_id).toBeNull();
    expect(bundle.media).toEqual(media);
  });
});

describe("readBundle", () => {
  it("parses the golden bundle fixture", () => {
    const text = JSON.stringify(loadFixture("sunday_bundle.json"));
    const { bundle, errors } = readBundle(text);
    expect(errors).toEqual([]);
    expect(bundle).not.toBeNull();
    expect(bundle!.kind).toBe("service_plan");
  });

  it("reports invalid JSON without throwing", () => {
    const { bundle, errors } = readBundle("{not json");
    expect(bundle).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/invalid JSON/);
  });

  it("reports a schema violation with a field path", () => {
    const { bundle, errors } = readBundle(JSON.stringify({ kind: "service_plan" }));
    expect(bundle).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("ServicePlan → bundle → parse round-trip", () => {
  it("survives write then read unchanged", () => {
    const plan = ServicePlan.parse(loadFixture("service_plan.json"));
    const bundle = writeServicePlanBundle(plan, {
      sourceApp: "sundayplan",
      churchId: "11111111-1111-1111-1111-111111111111",
      media: [
        {
          rel_path: "media/sermon.mov",
          content_hash:
            "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          byte_size: 1048576,
          kind: "video",
        },
      ],
      createdAt: "2026-05-31T08:00:00Z",
    });
    const text = JSON.stringify(bundle);
    const { bundle: parsed, errors } = readBundle(text);
    expect(errors).toEqual([]);
    expect(parsed).toEqual(bundle);
    expect(parsed!.service_plan).toEqual(plan);
  });
});
