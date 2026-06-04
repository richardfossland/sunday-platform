# @sunday/contracts

Canonical **cross-app wire contracts** for the Sunday Suite — the shapes every
app uses to talk to every other app. Types + runtime [Zod](https://zod.dev)
schemas in one place, so a payload that leaves SundayPlan is validated the same
way when it arrives in SundayStage, SundayRec or SundaySong.

The Rust crate [`sunday-contracts`](../../crates/sunday-contracts) mirrors these
exact shapes. The golden `fixtures/*.json` at the repo root are the single source
of truth both languages round-trip against — see [Cross-language parity](#cross-language-parity).

## Design rules

- **Every payload carries a `schema_version`.** It defaults to the current
  [`SCHEMA_VERSION`](./src/common.ts) when omitted and accepts any positive
  integer up to `MAX_SCHEMA_VERSION` (`u32::MAX`, the Rust twin's ceiling). This
  is the forward-compatibility guarantee: a desktop app that updates rarely must
  keep parsing payloads from the daily-deploying web. Never pin a version with
  `z.literal`.
- **Consumers ignore unknown fields** — forward-compatible by default.
- **Nullable fields tolerate an omitted key** (coerced to `null`) to match Rust
  serde's `Option<T>`, where a missing key is `None`. Use `nullableField`, not a
  bare `.nullable()`.

## What's in here

| Module      | Contract / helpers                                                            |
| ----------- | ----------------------------------------------------------------------------- |
| `common`    | `SCHEMA_VERSION`, `MAX_SCHEMA_VERSION`, `schemaVersionField`, `nullableField` |
| `song`      | `SongRef` — a reference to a SundaySong work (CCLI / TONO ids, key, language) |
| `service`   | `ServiceRef`, `SetlistItem`, `ServicePlan` — a service + its ordered items    |
| `usage`     | `UsageEvent` + `makeUsageIdempotencyKey` — CCLI/TONO reporting, deduped       |
| `live`      | `LiveEvent` — the Stage → Rec live stream (cue advanced, now playing, …)      |
| `deeplink`  | `MediaHandoff`, `parseHandoffUrl` / `buildHandoffUrl`, `resultCallbackUrl`    |
| `bundle`    | `SundayBundle`, `writeServicePlanBundle` / `readBundle` — the `.sundaybundle` |
| `mapping`   | Plan ↔ Stage service-item-kind mapping                                        |
| `recording` | `RecordingManifest`, `RecordingSegment` + derived helpers                     |
| `builders`  | `buildServicePlan`, `buildRecordingManifest`, `extractSongRefs`, …            |

## Usage

```ts
import {
  ServicePlan,
  readBundle,
  makeUsageIdempotencyKey,
  parseHandoffUrl,
} from "@sunday/contracts";

// Validate an inbound payload (throws on a bad shape).
const plan = ServicePlan.parse(json);

// Or fail soft.
const result = ServicePlan.safeParse(json);
if (!result.success) {
  /* result.error */
}

// Read an offline `.sundaybundle` (validates schema_version + every item).
const { bundle, errors } = readBundle(fileText);

// Derive the dedup key the usage API expects (one report per service item).
const key = makeUsageIdempotencyKey(serviceId, serviceItemId);

// Parse a deep-link handoff URL into the shared MediaHandoff shape.
const handoff = parseHandoffUrl(url, "sundayedit");
```

## Cross-language parity

The TypeScript schemas here and the Rust structs in `crates/sunday-contracts`
are two views of one contract. Two conformance suites keep them honest by
round-tripping the SAME `fixtures/*.json`:

- TS: `packages/contracts/test/conformance.test.ts`
- Rust: `crates/sunday-contracts/tests/conformance.rs`

They cover not just the happy fixture but the boundaries — `schema_version`
forward-compat up to `u32::MAX` (and rejection past it), a zero-item
`ServicePlan`, an in-progress `RecordingManifest` with a null `ended_at`, and
omitted-nullable-key tolerance. If TS and Rust ever disagree on a shape, one of
these (or its twin) fails. When you change a contract, update both sides and the
fixture together.

## Develop

```sh
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
```

From the repo root, `cargo test -p sunday-contracts` runs the Rust twin.
