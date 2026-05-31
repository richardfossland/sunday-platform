# Sunday Platform — phase status

The cross-app foundation, built fundament-first (contracts + identity before any
bridge). Plan of record: `~/.claude/plans/jeg-holder-p-eager-book.md`.

## Fase 0 — Contracts + tenant consolidation ✅ (logic complete, DB-applies pending)

| Deliverable                       | Where                                                             | Status                                                  |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `@sunday/contracts` (TS + Zod)    | `packages/contracts`                                              | ✅ 29 vitest green, tsc clean                           |
| `sunday-contracts` (Rust + serde) | `crates/sunday-contracts`                                         | ✅ 12 cargo tests green, fmt + clippy -D warnings clean |
| Cross-language conformance        | `fixtures/*.json`                                                 | ✅ both suites round-trip the same golden JSON          |
| Plan identity migration           | `sundayplan/supabase/migrations/0010_platform_identity.sql`       | ✅ written — ⏳ needs `supabase db push` to verify      |
| Stage tenant migration (Funn A)   | `sundaystage/backend/supabase/migrations/0003_church_tenancy.sql` | ✅ written — ⏳ needs `supabase db push` to verify      |

**Contracts delivered:** `SongRef`, `UsageEvent`, `ServiceRef`/`SetlistItem`/`ServicePlan`,
`LiveEvent` (cue.advanced / now_playing / service.live / service.ended),
`MediaHandoff` deep-link (generalized superset of SundayEdit's `deeplink.rs`),
`SundayBundle` offline envelope. All carry `schema_version` (=1); unknown fields ignored.

### ⏳ Needs a machine with Docker (deferred — Docker unavailable during the build)

- `cd sundayplan && supabase db reset` to apply 0010 and run RLS/hook checks.
- `cd sundaystage/backend && supabase db push` (or reset) to apply 0003; verify the
  redefined `is_member`/`can_write` still gate every content table, now church-scoped.
- Enable the access-token hook in the SundayPlan Supabase project config
  (Auth → Hooks → Customize Access Token → `public.custom_access_token_hook`).

## Fase 1 — Sunday ID (in progress)

- ✅ `sunday-auth` Rust crate (`crates/sunday-auth`): PKCE (RFC 7636 S256,
  verified vs the RFC vector), OAuth loopback-callback parsing + `state` check,
  OS-keychain `SecretStore` (promoted from SundayRec) + `SUNDAY_ACCOUNT_REFRESH`.
  14 cargo tests; fmt + clippy clean.
- ✅ `@sunday/auth-client` (TS, `packages/auth-client`): PKCE helpers (WebCrypto,
  same RFC vector as the Rust crate) + Supabase JWT validation via JWKS (`jose`)
  with `church_ids` / `app_grants` claim extraction + `hasChurchAccess` /
  `hasAppGrant`. 10 vitest; tsc clean.
- ⏳ Wire JWT validation into `sundaysong/apps/api` (`middleware/auth.ts`),
  deriving `church_id` from the token's `church_ids` claim (never from the body)
  — uses `@sunday/auth-client`. Needs a Supabase project to integration-test.
- ⏳ The impure desktop login glue (loopback `TcpListener`, browser, `reqwest`
  token exchange, Supabase authorize-URL) — lives in each app's shell; drives
  `sunday-auth`. Needs a real device + Supabase project.
- ⏳ Switch the Supabase project to asymmetric (RS256) JWTs.
- ✅ `@sunday/design` (TS, `packages/design`): dependency-free design tokens —
  shared `PALETTE` / `TYPOGRAPHY` / `SPACING` / `RADIUS` + a per-app `ACCENTS`
  map (rec/stage/plan/song = suite hues, sundayedit/sundaystudio dark "pro",
  sundaystudio = gold, sundaypaper = copper), plus a Tailwind v4 `@theme`
  stylesheet (`src/theme.css`, exported as `@sunday/design/theme.css`). 6 vitest
  (accent map covers all 7 apps), tsc clean.
- ✅ Sunday Bridge helpers in `@sunday/contracts`: `writeServicePlanBundle` /
  `readBundle` (`.sundaybundle` round-trip, non-throwing parse) and the bridge
  builders `buildUsageEvent` (derives the idempotency key) / `liveCueEvent` /
  `nowPlayingEvent` (monotonic `sequence`). Mirrored cheaply into `sunday-contracts`
  (`build_usage_event`, `write_service_plan_bundle`, `LiveEvent::cue_advanced` /
  `now_playing`); `read_bundle` has no Rust mirror — callers use
  `serde_json::from_str::<SundayBundle>` directly. See `docs/PUSH.md` for tagging
  + per-app consumption.

## Fase 2+ — Bridges

Plan→Stage setlist sync · Stage→Song usage (`/v1/usage/log`, contract `UsageEvent`)
· Rec→Edit/Studio deep-link (`MediaHandoff`) · Stage→Rec cues (`LiveEvent` over
Supabase Realtime, `liveChannel`) · Plan↔Song licensing · Paper bulletins. See plan.

## How apps consume these packages

```jsonc
// TS app package.json (until a registry exists, by git tag):
"@sunday/contracts": "github:richardfossland/sunday-platform#v0.1.0&path:/packages/contracts"
```

```toml
# Rust app Cargo.toml:
sunday-contracts = { git = "https://github.com/richardfossland/sunday-platform", tag = "v0.1.0" }
```
