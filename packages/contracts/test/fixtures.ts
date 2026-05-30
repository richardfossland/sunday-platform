import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** Repo-root /fixtures — the shared golden JSON both languages round-trip against. */
export const FIXTURES_DIR = resolve(here, "../../../fixtures");

export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), "utf8")) as T;
}
