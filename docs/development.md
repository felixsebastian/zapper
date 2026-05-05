# Local Development

Guide for contributing to zapper.

## Repository Layout

Zapper is a pnpm workspace:

- `packages/cli` contains the published CLI package, source, unit tests, e2e tests, examples, and CLI-specific tooling.
- `apps/landing-page` contains the Next.js landing page.
- `docs` contains the VitePress documentation site. Its Markdown files remain the source of truth, and `pnpm --filter @mp-lb/zapper-docs raw` generates `llms.txt` and `llms-full.txt` for agents and automation.
- `infra` contains Terraform-managed deployment resources for the landing page.

## Prerequisites

- Node.js 18+
- pnpm
- PM2 (`npm install -g pm2`)
- Docker (for testing docker services)

## Getting Started

```bash
npm uninstall --global zapper-cli @maplab/zapper @mp-lb/zapper  # Start fresh
pnpm remove --global zapper-cli @maplab/zapper @mp-lb/zapper     # Remove stale pnpm links
pnpm add --global @mp-lb/zapper  # Make sure it's installed with pnpm
pnpm install
pnpm build
cd packages/cli && pnpm link --global && cd ../..
```

After linking, your global `zap` command points to the local CLI package build. Make changes, run `pnpm build`, and test immediately.

## Linking & Unlinking

```bash
which zap                 # Should show pnpm global path
ls -la $(which zap)       # Should symlink to packages/cli/dist/index.js
sed -n '1,80p' $(which zap)  # Should execute this checkout's packages/cli/dist/index.js
pnpm list -g --depth 0    # Should show @mp-lb/zapper@link:<this checkout>

# Unlink when done
pnpm unlink --global
npm install --global @mp-lb/zapper  # Reinstall from npm
```

If `zap` still points at an old checkout, remove the stale global package name
and link again:

```bash
pnpm remove --global zapper-cli @maplab/zapper @mp-lb/zapper
pnpm build
cd packages/cli && pnpm link --global && cd ../..
```

## Testing

```bash
pnpm test                        # Run CLI unit tests
pnpm test:watch                  # CLI unit test watch mode
pnpm --filter @mp-lb/zapper test yaml-parser.test.ts    # Specific CLI test file
pnpm test:e2e                    # E2E in isolated Linux VM (macOS + Lima)
pnpm dev:renderer                # Renderer vibe sheet (local development preview)
pnpm dev:landing                 # Landing page dev server
pnpm dev:docs                    # VitePress docs dev server on 127.0.0.1:4315
pnpm docs:build                  # Build the docs site and generated raw docs
```

For manual CLI testing, use the example projects in `packages/cli/examples/`. After building, cd into one and run `zap up`.

## macOS Menu Bar App

The native macOS app lives in `apps/macos`. It is a lightweight SwiftUI
dashboard hosted by an AppKit menu bar status item. It shells out to the
installed `zap` CLI for reads and actions: `zap system projects --json`,
`zap home --json`, and `zap up`/`zap down` for instances or individual services.
It does not parse `.zap` state or `zap.yaml` directly.

The first version does not require opening Xcode. Build and run it with:

```bash
apps/macos/bin/build
apps/macos/bin/run
apps/macos/bin/clean
```

The build script uses `swiftc` and writes `apps/macos/build/Zapper.app`. The app
looks for `zap` in `ZAPPER_CLI_PATH`, a saved in-app override, standard Homebrew
and JavaScript package-manager paths, LaunchServices `PATH`, and the login
shell `PATH`. If discovery still fails, use the terminal button in the app to
choose the `zap` executable; the selected path is stored in user defaults.

GitHub Actions builds release assets through `.github/workflows/macos-release.yml`.
The workflow runs on `v*` tags or manual dispatch, zips `Zapper.app`, and
attaches both `Zapper-<tag>-macOS.zip` and the stable `Zapper-macOS.zip` asset
to the matching GitHub Release.

Local app builds are ad-hoc signed unless `CODESIGN_IDENTITY` is set. Release
builds load `CSC_LINK`, `APPLE_ID`, and `APPLE_TEAM_ID` from `.env.production`,
load `CSC_KEY_PASSWORD` and `APPLE_APP_SPECIFIC_PASSWORD` from the
`PRODUCTION_SECRETS` GitHub Actions env-file secret, and then sign with the
hardened runtime before notarizing and packaging.

## Documentation Site

The docs website is a VitePress workspace package in `docs`. Keep editing the Markdown files in `docs/`; VitePress turns them into the website, and the raw docs generator publishes agent-friendly files from the same source.

```bash
pnpm dev:docs
pnpm docs:build
pnpm docs:preview
```

`pnpm build` runs the docs build through Turbo. The generated site lives in `docs/.vitepress/dist`, and the published raw files are available at `/llms.txt` and `/llms-full.txt` in the built site.

### E2E in Linux VM (macOS)

```bash
bash ./packages/cli/etc/e2e_setup.sh          # One-time: install Lima + provision base VM
pnpm test:e2e                    # Each run clones an isolated throwaway VM
```

Notes:

- `pnpm test:e2e` runs in an ephemeral cloned VM and auto-deletes it on exit.
- Base VM name defaults to `zapper-e2e-base` (override with `ZAP_E2E_BASE_VM_NAME`).
- Keep a failed run VM for debugging: `ZAP_E2E_KEEP_VM=1 pnpm test:e2e`.
- By default, `pnpm test:e2e` is strict and fails if VM setup is missing.

## Web Deployment

The landing page lives in `apps/landing-page`, and the docs site lives in `docs`. Both are deployed by `.github/workflows/deploy-web.yml`.

Deployment resources are managed through Terraform in `infra`. Terraform creates separate Vercel projects for the landing page and docs site, plus Cloudflare DNS records for `zapper.mp-lb.dev` and `docs.zapper.mp-lb.dev` by default.

```bash
cd infra
terraform init -backend-config="bucket=<gcp-project-id>-terraform-state" -backend-config="prefix=terraform/state/zapper"
terraform apply \
  -var="project_name=zapper" \
  -var="vercel_api_token=$VERCEL_API_TOKEN" \
  -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
  -var="cloudflare_zone_id=$CLOUDFLARE_ZONE_ID"
```

The workflow provisions the Vercel projects/domains through Terraform, builds `@mp-lb/zapper-landing-page` and `@mp-lb/zapper-docs`, then deploys both projects with the Vercel CLI.
The landing page `/download/mac` route redirects to the latest macOS GitHub
Release zip. Add `DESKTOP_RELEASES_GITHUB_TOKEN` to the `PRODUCTION_SECRETS`
repository secret env file when the route needs higher GitHub API limits or
access to non-public release assets; Terraform passes that token into the Vercel
project runtime environment.

## Release CI Auth

Release publishing runs through `.github/workflows/release.yml`.

- The workflow is prepared for npm trusted publishing via GitHub Actions OIDC and can fall back to `secrets.NPM_TOKEN`.
- npm trusted publishing currently requires Node `22.14.0+` and npm CLI `11.5.1+`; the release workflow upgrades npm explicitly before publishing.
- npm currently requires either trusted publishing or a granular write token with **Bypass two-factor authentication** enabled for non-interactive package publishes.
- The release workflow passes `NPM_TOKEN` to `changesets/action` when the repository secret exists. If the secret is absent, Changesets can use OIDC trusted publishing.
- The release workflow logs the token length, a short SHA-256 token fingerprint, `npm whoami`, and package collaborator access before publishing. It does not print token characters.
- If release CI fails with `EOTP`, the configured `NPM_TOKEN` is not suitable for package publishing and must be replaced or removed after trusted publishing is set up on npm.
- Keep `packages/cli/package.json` `repository.url` aligned with the canonical GitHub repo because npm checks it for GitHub trusted publishing.
