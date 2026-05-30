# Sunday-suite — natt-rapport 2026-05-30

Autonom økt: bygde det felles fundamentet (platform Fase 0), fortsatte SundayRec
(Fase 6.2), og reviderte alle programmene. Alt committet lokalt — **ingenting
pushet** (GitHub Actions-kvote nådd).

## Bygget i natt

### Platform Fase 0 — felles fundament (NYTT repo `sunday-platform`)

- `@sunday/contracts` (TS + Zod) + `sunday-contracts` (Rust + serde): kanoniske
  kryss-app-kontrakter — `SongRef`, `UsageEvent`, `ServiceRef`/`SetlistItem`/
  `ServicePlan`, `LiveEvent` (cue/now_playing/service-live/ended), `MediaHandoff`
  deep-link (superset av SundayEdit `deeplink.rs`), `SundayBundle`. `schema_version`
  på alt; ukjente felt ignoreres (forward-compatible).
- Kryss-språk-konformitet uten codegen: `fixtures/*.json` er sannhetskilden begge
  språk runder mot. **29 vitest + 12 cargo grønne; tsc + fmt + clippy rene.**
- 5 commits (`37c2293`→`577a762`). Distribueres via git-tag (ingen delt CI).

### SundayPlan — `0010_platform_identity.sql` (commit `8b5ce18`)

`app_grant` (per-bruker app-tilgang) + `custom_access_token_hook` (stamper JWT med
`church_ids`/`app_grants` så SundaySong autoriserer fra token via JWKS, aldri fra
body). ⏳ Krever `supabase db push` + hook aktivert i prosjekt-config.

### SundayStage — `0003_church_tenancy.sql` (commit `726cd5d`) — **Funn A løst**

Migrerer Stage fra `library`/`is_member` til `church`/`is_member_of` (samme form +
hjelpenavn som Plan); `library` blir under-entitet. `is_member`/`can_write`
redefinert til å gå via kirken → alle innholds-policyer i 0002 virker uendret,
nå kirke-scopet. ⏳ Krever `supabase db push`.

### SundayRec — Fase 6.2 durable opplastingskø (commit `6f47771`)

F6.1-kjernen var ferdig (ren oauth/retry/queue/drive). La til det testbare urene
skallet: migrasjon `0003_upload_queue` (durabel kø, erstatter electron-store),
`cloud/store.rs` (sqlx-persistens), `cloud/mod.rs` (manager + connection-status
over keychain), 7 nettverks-frie kommandoer, og `CloudBackupPanel` UI. **Hele
`npm run check` grønn** (eslint+tsc+60 vitest+clippy --workspace+cargo test
--workspace). Gjenstår (docs/PHASE6.md): OAuth-connect + upload-worker (nett/
hardware-uverifiserbart) + F3.3b auto-wire → tracket som egen oppgave.

## Revisjon — status pr. program (alle arbeidstrær RENE, alle på `main`)

| Program             | Gate                                                                                                                  | Upushet                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| sunday-platform     | 29 vitest + 12 cargo ✅                                                                                               | nytt repo — trenger remote + push |
| sundayrec           | `npm run check` ✅ (full)                                                                                             | 1                                 |
| sundaystage         | `npm run check` ✅ (inkl. committed song_import + 0003)                                                               | 8                                 |
| sundayplan          | turbo 9/9 ✅ (auth 27)                                                                                                | 19                                |
| sundaysong          | 197/201 ✅ — 4 feil = `PostgresError: Connection closed` (ingen lokal Postgres/Docker; miljøbetinget, ikke regresjon) | 2                                 |
| sundaystudio        | 140 cargo + vitest ✅                                                                                                 | 7                                 |
| sundaypaper         | `npm run check` ✅ (full)                                                                                             | 0                                 |
| verbatim/SundayEdit | 52 vitest + cargo ✅                                                                                                  | 8                                 |

Worktree-grenene (f33b/f6/fase5) er konsolidert bort tidligere. Ingen løs WIP funnet.

## Push-sjekkliste (når Actions-kvoten resettes)

1. **Opprett remote for `sunday-platform`** (privat) og `git push -u origin main`.
2. Push de upushede commitene i: sundayrec(1), sundaystage(8), sundayplan(19),
   sundaysong(2), sundaystudio(7), verbatim(8).
3. Tag `sunday-platform` `v0.1.0` så appene kan konsumere kontraktene via git-tag.

## Krever Richard / infrastruktur (kan ikke verifiseres her — Docker utilgjengelig)

- `supabase db push`/`reset` for Plan `0010` + Stage `0003` (+ aktiver access-token-hook).
- Lokal Postgres for sundaysong sine 4 DB-tester.
- SundayRec: all opptak-/cloud-I/O forblir HARDWARE/NETT-UVERIFISERT til kjørt på rigg.
