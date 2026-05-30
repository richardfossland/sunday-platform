# Sunday Platform — phase status

The cross-app foundation, built fundament-first (contracts + identity before any
bridge). Plan of record: `~/.claude/plans/jeg-holder-p-eager-book.md`.

## Fase 0 — Contracts + tenant consolidation ✅ (logic complete, DB-applies pending)

| Deliverable | Where | Status |
|---|---|---|
| `@sunday/contracts` (TS + Zod) | `packages/contracts` | ✅ 29 vitest green, tsc clean |
| `sunday-contracts` (Rust + serde) | `crates/sunday-contracts` | ✅ 12 cargo tests green, fmt + clippy -D warnings clean |
| Cross-language conformance | `fixtures/*.json` | ✅ both suites round-trip the same golden JSON |
| Plan identity migration | `sundayplan/supabase/migrations/0010_platform_identity.sql` | ✅ written — ⏳ needs `supabase db push` to verify |
| Stage tenant migration (Funn A) | `sundaystage/backend/supabase/migrations/0003_church_tenancy.sql` | ✅ written — ⏳ needs `supabase db push` to verify |

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

## Fase 1 — Sunday ID (next)

- `sunday-auth` Rust crate: promote SundayRec's `secrets/mod.rs` keyring seam, add
  PKCE + loopback callback + token refresh; new `SecretProvider::SundayAccount`.
- `@sunday/auth-client` (TS): PKCE helper + Supabase session + JWKS validation.
- Wire JWT validation into `sundaysong/apps/api` (`middleware/auth.ts`), deriving
  `church_id` from the token's `church_ids` claim (never from the body).
- Switch the Supabase project to asymmetric (RS256) JWTs.

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
