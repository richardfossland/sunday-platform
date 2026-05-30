# Sunday Platform

Shared platform code for the **Sunday suite** — the common base that lets the
seven apps (SundayRec, SundayStage, SundayPlan, SundaySong, SundayEdit,
SundayStudio, SundayPaper) speak one language, share one identity, and hand work
off to one another ("Sunday Bridge").

This repo deliberately holds **only cross-app code**. Each app keeps its own
repo, toolchain and release cycle. We distribute these packages by **git tag**,
not via a registry (the suite has no shared CI yet).

## Layout

```
packages/
  contracts/        @sunday/contracts — canonical cross-app types + Zod schemas (TS)
crates/
  sunday-contracts/ Rust mirror of the same wire contracts (serde)
fixtures/           Golden JSON — the single source of truth both languages
                    round-trip against (cross-language conformance without codegen)
```

Planned (see `~/.claude/plans/`):

```
packages/
  auth-client/      @sunday/auth-client — PKCE helper + Supabase session + JWKS validation
  cloud-client/     @sunday/cloud-client — typed client to the Sunday API
  design/           @sunday/design — Tailwind v4 tokens + brand
  ui/               @sunday/ui — shared React primitives
crates/
  sunday-auth/      Rust: keyring secret store (promoted from sundayrec) + PKCE + token refresh
```

## The contract is versioned

Every wire payload carries a `schema_version` (currently **1**). Consumers MUST
ignore unknown fields (forward-compatible, like SundayEdit's `deeplink.rs`).
Never remove or rename a field without a major bump and a deprecation cycle —
desktop apps update rarely while the web deploys daily, so an old SundayStage
must keep talking to a new SundaySong.

## Cross-language conformance

`fixtures/*.json` are canonical example payloads. The TypeScript test suite
(`vitest`) and the Rust test suite (`cargo test`) both parse → re-serialize each
fixture and assert it round-trips to the same JSON value. If the two languages
ever diverge on a shape, a fixture test fails. No code generator to run.

## Develop

```bash
pnpm install
pnpm -r test         # TypeScript (vitest)
cargo test           # Rust
pnpm test:all        # both
```
