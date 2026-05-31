# sunday-platform — smoke tests (UNVERIFIED seams)

Pure logic is unit-tested and green in the normal gate (`pnpm -r build && pnpm -r test`
+ `cargo test`). This file tracks the seams that **compile + are unit-tested
against a mock**, but whose *real* I/O could not be exercised in the build
environment (no network, no GUI, no infra). Each row is a manual check for
Richard once the real target exists.

| Area | Package | Seam | Status | How to verify (manual) |
| --- | --- | --- | --- | --- |
| Cloud API transport | `@sunday/cloud-client` | `CloudTransport` default `fetch` → real HTTP against the SundaySong API | NETWORK-UNVERIFIED | Point `SundayCloudClient` at a running API (`baseUrl`), call `sources.list()` / `songs.search({ q })`; expect a 2xx JSON body. Tests cover shaping + retry via an injected mock only. |
| Usage logging | `@sunday/cloud-client` | `usage.log(buildUsageEvent(...))` → `POST /v1/usage/log` | NETWORK-UNVERIFIED | With a real `apiKey`, log an event twice with the same `idempotency_key`; expect `{ logged: true }` then `{ logged: false }` (dedupe). |
| Licensing CSV | `@sunday/cloud-client` | `licensing.reportCsv(...)` → `POST /v1/licensing/report.csv` | NETWORK-UNVERIFIED | Against a church with a licensing profile + usage rows, fetch `system: "tono"`; expect raw CSV text (not JSON). |
| Accent CSS vars | `@sunday/ui` | `AppAccentProvider` setting `--color-accent*` on a real DOM | GUI-UNVERIFIED | Render `<AppAccentProvider app="sundaystudio">` in an app and confirm a `Button` reads gold (not the blue default) in the browser; jsdom tests assert the data attrs + inline vars only. |
| Primitive rendering | `@sunday/ui` | `Button` / `Card` / `Badge` / `Field` visual layout | GUI-UNVERIFIED | Mount the primitives in a real Tauri/Next app, eyeball spacing/contrast across light + dark (`Card dark`) surfaces. |
