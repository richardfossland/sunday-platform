import { defineConfig } from "vitest/config";

/**
 * The UI primitives render through React, so tests run in a jsdom DOM. (The
 * other platform packages are pure logic and use vitest's default node env.)
 */
export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
