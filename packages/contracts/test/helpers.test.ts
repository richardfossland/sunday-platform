import { describe, expect, it } from "vitest";

import {
  APP_SCHEME,
  liveChannel,
  makeUsageIdempotencyKey,
  SCHEMA_VERSION,
  SundayApp,
} from "../src/index.js";

describe("helpers", () => {
  it("builds a per-tenant realtime channel", () => {
    expect(liveChannel("c1", "s1")).toBe("church:c1:service:s1");
  });

  it("builds a stable usage idempotency key", () => {
    expect(makeUsageIdempotencyKey("svc", "7")).toBe("svc-svc:item-7");
  });

  it("schema version is 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  it("every app has a distinct scheme", () => {
    const apps = SundayApp.options;
    const schemes = apps.map((a) => APP_SCHEME[a]);
    expect(new Set(schemes).size).toBe(apps.length);
  });
});
