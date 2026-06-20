# Distributing `@sunday/*` packages

The Sunday suite shares code (`@sunday/contracts`, `@sunday/web-platform`,
`@sunday/auth-client`, `@sunday/design`, `@sunday/cloud-client`, `@sunday/ui`)
across ~11 **npm** web apps, the pnpm platform, and the Rust desktop apps. This
is the one, long-term way those packages are distributed.

## The decision: public npm registry (`@sunday` scope)

Earlier the packages were consumed only via **git tags** with pnpm's
subdirectory syntax:

```
"@sunday/contracts": "github:richardfossland/sunday-platform#v0.4.1&path:/packages/contracts"
```

That works for **pnpm and cargo**, but **npm does not support the `&path:`
subdirectory** — `npm install` silently pulls the monorepo *root* instead of the
sub-package. Since every web app is npm, none of them could ever consume a shared
package this way. Tarball-URLs and gitpkg are workarounds that avoid a registry;
for public, shared, long-lived packages the correct foundation is a **registry**.

So `@sunday/*` is published to the **public npm registry**:

- **Idiomatic consumption** — `npm i @sunday/contracts` (or pnpm/yarn), semver,
  lockfile integrity, no bespoke URLs, dependable tooling.
- **No tokens to consume** — public packages install without auth, everywhere
  (app CI, Cloudflare/OpenNext builds, local dev). Only *publishing* needs a token.
- **One channel for all consumers** — npm apps, the pnpm platform, and (via the
  same versions) anything else. `dist/` ships pre-built in the published tarball,
  so consumers never build it (this retires the `prepare`/git-tag-dist workaround).

## Consuming a package

Pin an exact version (matches the suite's "nothing changes until I bump it"
philosophy — no surprise updates):

```jsonc
// an app's package.json
"dependencies": {
  "@sunday/contracts": "0.4.1"
}
```

Then `npm install`. No `.npmrc`, no token.

## Publishing (automated)

`.github/workflows/publish.yml` publishes on a **version tag** or a manual run:

```
# bump the package version(s), then:
git tag v0.4.2 && git push origin v0.4.2      # → CI builds + publishes
# or: Actions → "Publish packages" → Run workflow (workflow_dispatch)
```

The workflow runs `pnpm install` → `pnpm -r build` → `pnpm -r publish --access
public`. pnpm publishes every non-private workspace package at its current
version (skipping versions already on the registry) and **rewrites `workspace:*`
dependencies to the concrete published versions** automatically.

## One-time setup (owner)

1. **Create the `@sunday` org on npmjs** — https://www.npmjs.com/org/create
   (free for public packages). The scope is currently unclaimed.
2. **Add an npm token** — npmjs → Access Tokens → *Automation* token → add it as
   the **`NPM_TOKEN`** secret in the `sunday-platform` repo
   (Settings → Secrets and variables → Actions).
3. **First publish** — merge this pipeline, then run the *Publish packages*
   workflow (workflow_dispatch). It publishes all `@sunday/*` at their current
   versions. After that, app deps like `"@sunday/contracts": "0.4.1"` resolve.

If the `@sunday` org name is ever unavailable, rename the scope (e.g.
`@sundaysuite`) consistently across the packages + import sites; nothing else
about the pipeline changes.

## Versioning

- Bump the changed package's `version`, tag `vX.Y.Z`, push → CI publishes.
- Consumers bump their pinned version deliberately (a reviewable PR per app; a
  cross-repo bump script is the planned helper).

## Future hardening

- **npm provenance** (`--provenance` + `id-token: write` + a `repository` field
  on every package) for supply-chain attestation once all packages carry
  `repository`.
- **Changesets** for coordinated version bumps + changelogs across the workspace.
