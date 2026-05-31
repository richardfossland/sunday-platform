# Publishing & consuming sunday-platform

There is **no package registry and no shared CI** for the Sunday suite (the
GitHub Actions quota is the constraint). We distribute these packages the cheap,
durable way: a **private GitHub repo** that each app pins to by **git tag**.

This document is the runbook for cutting `v0.1.0` and wiring each app to it. It
does **not** push anything — run the commands yourself when you're ready.

## 1. Create the private remote (once)

```bash
# From the repo root. Uses the gh CLI; --private keeps the suite closed-source.
gh repo create richardfossland/sunday-platform --private --source=. --remote=origin --disable-issues --disable-wiki

# If the repo already exists, just add the remote:
git remote add origin https://github.com/richardfossland/sunday-platform.git
```

> Do **not** enable Actions / workflows here — there is no CI on this repo by
> design. Consumers build the packages locally from source at the pinned tag.

## 2. Verify the gate is green, then tag `v0.1.0`

```bash
pnpm install
pnpm -r build && pnpm -r test       # TypeScript: contracts + auth-client + design
cargo test                          # Rust: sunday-contracts + sunday-auth
cargo clippy --all-targets -- -D warnings
cargo fmt --check

# Only when all of the above pass:
git tag -a v0.1.0 -m "sunday-platform v0.1.0: contracts, auth-client, design, sunday-contracts, sunday-auth"
git push origin main
git push origin v0.1.0
```

The tag is the contract surface: once an app pins to `v0.1.0`, that tree never
changes under it. Cut a new tag (`v0.1.1`, `v0.2.0`, …) for every change a
consumer should pick up. Never move a tag.

## 3. How each app consumes the packages

### TypeScript apps (SundaySong, SundayPlan web, and the Tauri front-ends)

Pin by tag with pnpm's `github:` protocol, scoped to the package's subdirectory:

```jsonc
// app package.json — dependencies
{
  "@sunday/contracts": "github:richardfossland/sunday-platform#v0.1.0&path:/packages/contracts",
  "@sunday/auth-client": "github:richardfossland/sunday-platform#v0.1.0&path:/packages/auth-client",
  "@sunday/design": "github:richardfossland/sunday-platform#v0.1.0&path:/packages/design"
}
```

Then in the app:

```ts
import { buildUsageEvent, writeServicePlanBundle, readBundle } from "@sunday/contracts";
import { ACCENTS, accentFor } from "@sunday/design";
```

```css
/* app root stylesheet (Tailwind v4) */
@import "tailwindcss";
@import "@sunday/design/theme.css";
/* set the per-app accent from @sunday/design's ACCENTS map, e.g. SundayStudio: */
:root {
  --color-accent: #d4a017;
  --color-on-accent: #1a1505;
}
```

> These are **source** packages (their `package.json` ships both `dist` and
> `src`, and the `build` script is `tsc`). A consumer installing from git gets a
> prebuilt `dist/` if it was committed at the tag, or runs the package's own
> build. Keep `dist/` out of git (it is `.gitignore`d) and let the consumer build,
> or add a `prepare` script per package if a registry-less install needs it.

### Rust apps (the Tauri shells)

Pin the crates by tag in the app's `Cargo.toml`:

```toml
[dependencies]
sunday-contracts = { git = "https://github.com/richardfossland/sunday-platform", tag = "v0.1.0" }
sunday-auth      = { git = "https://github.com/richardfossland/sunday-platform", tag = "v0.1.0" }
```

```rust
use sunday_contracts::{build_usage_event, write_service_plan_bundle, LiveEvent, BuildUsageEventInput};
```

Cargo resolves the workspace member by crate name within the pinned tree — no
extra path needed.

## 4. Cutting later versions

1. Land the change on `main` with the gate green (section 2).
2. `git tag -a vX.Y.Z -m "…"` and `git push origin vX.Y.Z`.
3. In each consuming app, bump the tag in `package.json` / `Cargo.toml`, then
   `pnpm install` / `cargo update -p sunday-contracts`.

Bump the wire `SCHEMA_VERSION` only on a breaking contract change, paired with a
deprecation cycle — desktop apps update rarely while the web deploys daily, so an
old SundayStage must keep talking to a new SundaySong.
```
