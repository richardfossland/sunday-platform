import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/log";

afterEach(() => vi.restoreAllMocks());

describe("createLogger", () => {
  it("emits one JSON line with app + level + ctx", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger({ app: "turnering" }).info("hello", { n: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0]![0] as string)).toEqual({
      app: "turnering",
      level: "info",
      msg: "hello",
      n: 1,
    });
  });

  it("respects the minimum level", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger({ app: "x", level: "error" });
    log.info("skip");
    log.error("kept");
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it("routes errors to a sink without throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const captured: unknown[] = [];
    createLogger({ app: "x", sink: { capture: (e) => captured.push(e) } }).error("boom");
    expect(captured).toHaveLength(1);
  });
});
