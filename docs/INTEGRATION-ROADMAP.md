# Sunday Suite — Integration Roadmap

_Night review 2026-06-08. A big-scope look at what the shared platform already
enables and how to make the suite's cross-app integrations genuinely smarter._

The thesis of the suite is that the apps are worth more together than apart. The
platform layer (`sunday-platform`) is where that value is encoded as **shared
contracts** so each app can stay independent yet interoperate.

---

## 1. The integration backbone today (mature)

`packages/contracts` (+ the byte-identical Rust mirror in `crates/sunday-contracts`,
conformance-tested against golden `fixtures/*.json`):

| Contract | What it connects | Status |
|---|---|---|
| **MediaHandoff** (deeplink) | Rec → Edit/Studio (`sundayedit://import?…`), result callback | ✅ types + builders/parsers; Edit-side wired, Rec callback receiver missing (see §3) |
| **LiveEvent** union | Stage → Rec/companion (`cue.advanced`, `now_playing`, `service.live/ended`) over Supabase Realtime | ✅ builders wired both ends; Realtime transport is a test seam (INFRA-UNVERIFIED) |
| **ServicePlan** | Plan → Stage (setlist + item kinds) | ✅ builder + mapping layer |
| **UsageEvent** | Stage/Plan → Song (`/v1/usage/log`, `was_streamed`, idempotency key) | ✅ wired; the TONO/CCLI moat |
| **SongRef** | cross-app song identity (sundaysong/CCLI/TONO ids; never copies lyrics) | ✅ |
| **RecordingManifest** | Rec → Edit/Studio/Plan (produced segments) | ✅ builder + helpers |
| **SundayBundle** | offline `.sundaybundle` envelope (Zip-Slip-safe) | ✅ |

**Identity:** PKCE + JWKS verification mirrored TS+Rust (`@sunday/auth-client` /
`sunday-auth`); `church_ids` + `app_grants` claims. DB migrations written, not yet
pushed; desktop login glue still per-app. **Design:** `@sunday/design` tokens
(gold thread + per-app jewel tones), consumed via `@sunday/design/theme.css`.

**Distribution:** consumers pin the platform by **git tag** (no registry);
every payload carries `schema_version` (currently 1); consumers ignore unknown
fields. This is the right model for rarely-updated desktop apps.

---

## 2. Magic moments — real vs aspirational

| Moment | Backed by | Status |
|---|---|---|
| Cue advance in Stage → chapter marker in Rec | `LiveEvent.now_playing` | ✅ real (fixtures exist) |
| Setlist in Plan → service in Stage | `ServicePlan` | ✅ real |
| Every displayed song → TONO/CCLI usage row in Song | `UsageEvent` | ✅ real |
| Recording in Rec → Edit/Studio | `RecordingManifest` + `MediaHandoff` | ✅ real (one-way) |
| Sermon in Rec → captions in Edit → back to Rec transcript | `MediaHandoff` + callback | ⚠️ **half-wired** (see §3a) |
| Stage live session → full Rec service manifest (setlist + chapters) | `RecordingManifest`/Stage manifest | ⚠️ **export gap** (see §3b) |
| Lyrics → SRT captions for Rec's upload | _no contract yet_ | ❌ aspirational |
| Sermon transcript → parish-magazine draft in Paper | _no contract yet_ | ❌ aspirational |

---

## 3. Concrete loop-closers found tonight (ready to greenlight)

These are small, high-value, and the contracts mostly exist. Deliberately NOT
shipped in tonight's releases because each touches shipped behavior and/or two
repos — they deserve a focused, reviewed change rather than an overnight gamble.

### 3a. Edit → Rec captions hand-back (close the sermon round-trip)
- **Today:** Rec sends `sundayedit://import?path=<video>&returnTo=sundayrec`; Edit
  captions it, exports SRT/VTT, and **builds** `sundayrec://captions?path=<srt>` —
  but Rec's deep-link parser only knows `oauth` + `import`, so the hand-back is
  dropped. Rec already has the importer (`integrations_sundayedit_import`).
- **Build:** (1) Edit: include the original recording path in the callback
  (`&recording=<path>`) — it has it from the import. (2) Rec: add a `Captions`
  action to `crates/sundayrec-core/src/link.rs::parse_deep_link` + a unit test,
  and route it in the deep-link dispatch to call the existing import.
- **Effort:** ~2–3 h across 2 repos. **Risk:** low (reuses tested import; the
  only new surface is one parser arm + one dispatch arm). **Recommend: YES.**

### 3b. Stage → Rec service-manifest export (setlist + chapters in one file)
- **Today:** Stage already exports chapter markers + SRT from the live session,
  and Rec already **imports** a `service-manifest.json` (`stage_import_manifest`,
  battle-tested). The gap: Stage has no command to emit that manifest.
- **Caveat found tonight:** the persisted `LiveSession` carries cue index +
  timestamps but **not** the schema `kind` or song IDs (CCLI/TONO/sundaysong) —
  those live in the planning-time `CueSummary`/service plan. A faithful manifest
  (the part that powers TONO/CCLI reporting) must thread the service plan through,
  not just map the session log.
- **Build:** a `bridge_export_manifest` command in Stage that joins the live
  session log with the service plan (kind + song IDs by `service_item_id`) into
  the `StageManifest` camelCase shape Rec parses; add a Stage test asserting the
  shape round-trips through Rec's parser fixtures.
- **Effort:** ~half a day (the plan-join is the real work). **Risk:** low-medium.
  **Recommend: YES, after 3a.**

---

## 4. Strategic opportunities (bigger, higher ceiling)

1. **Auto-chapters / auto-segmentation** — Rec subscribes to `now_playing` and
   auto-segments on song change, so Edit opens a pre-chopped timeline. Contracts
   exist (`LiveEvent`); needs Rec's Realtime listener (the default-off `bridge`
   feature) productionized + a `timestamp_sec` on chapter metadata.
2. **Timed-lyrics → captions** — the suite's unique caption story. Add a
   `SongLyrics` contract (lines + start/end ms); Stage emits display timing; Rec
   records it; Edit converts to a near-perfect SRT on import. Biggest scope, but
   nobody else can do it because we own the whole chain.
3. **Plan ↔ Stage post-service sync** — after the service, Stage pushes final
   `was_streamed` + attendance + setlist edits back to Plan; Plan seeds next
   month's TONO/CCLI baseline. Needs a small `ServiceMetadata` sidecar
   (`attended_count`/`archived_at`) + a two-way sync (idempotency already guards
   double-logs).

---

## 5. Recommended sequence

1. **Productionize the Realtime transport** (the one INFRA-UNVERIFIED seam under
   every live moment) — pick it once, share it, smoke-test against Supabase.
2. **3a** captions hand-back (closes a visible user loop, ~half a day).
3. **3b** Stage manifest export (setlist + chapters, with the plan-join).
4. **Opportunity 1** (auto-chapters) → then **3** (Plan↔Stage) → then the big
   one, **2** (timed-lyrics captions).
5. **Publish the platform as a real package** (or keep tag-pinning but cut a
   `v0.2.0` once 3a/3b land) so apps converge off the local mirrors
   ("converge once published" TODOs).

Everything in §3–4 needs a greenlight; none of it was shipped tonight.
