# sunday-platform — needs Richard (gated)

Work an agent cannot do (push/tag, real infra, API keys, GUI, network). These
block verification of the otherwise-complete, gate-green code.

## Publish + tag (unblocks the suite's mirror→package swap)

- **Push + tag `sunday-platform v0.1.0`** per `docs/PUSH.md` §1–2 (now covering
  `@sunday/cloud-client` + `@sunday/ui`). Agents cannot push or create remotes.
  Until then, consuming apps stay on their local contract mirrors.

## `@sunday/cloud-client` — live API (NETWORK-UNVERIFIED)

- A reachable **SundaySong API base URL** (prod `https://api.sundaysong.com` or a
  local `apps/api` instance) to exercise real calls — the unit tests use an
  injected mock `fetch` only.
- A real **Sunday API key / access token** for the authenticated endpoints
  (`usage.log`, `licensing.report` / `report.csv`). Issued by the Phase 5.1 auth
  surface.
- **CORS / auth alignment**: confirm the API allows the calling origin and that
  the bearer token carries the right `church_ids` / `app_grants` claims for the
  church being reported on.
- Run the `docs/SMOKE-TEST.md` cloud rows against that environment.

## `@sunday/ui` — visual / interaction (GUI-UNVERIFIED)

- Mount the primitives in a **real browser / Tauri webview** and eyeball the
  rendered result: accent fidelity per app (Studio gold, Paper copper, …),
  light vs. dark `Card` surfaces, focus/contrast/hit-targets. jsdom tests verify
  structure + props, not pixels.
- Decide whether to graduate the inline-token styling to the Tailwind
  `@theme`/utility classes from `@sunday/design/theme.css` once an app adopts the
  primitives (current approach is bundler-free on purpose).
