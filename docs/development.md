# Local Development

Guide for contributing to zapper.

## Repository Layout

Zapper is a pnpm workspace:

- `packages/cli` contains the published CLI package, source, unit tests, e2e tests, examples, and CLI-specific tooling.
- `apps/landing-page` contains the Next.js landing page.
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
pnpm --dir packages/cli link --global
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
pnpm --dir packages/cli link --global
```

## Testing

```bash
pnpm test                        # Run CLI unit tests
pnpm test:watch                  # CLI unit test watch mode
pnpm --filter @mp-lb/zapper test yaml-parser.test.ts    # Specific CLI test file
pnpm test:e2e                    # E2E in isolated Linux VM (macOS + Lima)
pnpm dev:renderer                # Renderer vibe sheet (local development preview)
pnpm dev:landing                 # Landing page dev server
```

For manual CLI testing, use the example projects in `packages/cli/examples/`. After building, cd into one and run `zap up`.

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

## Landing Page Deployment

The landing page lives in `apps/landing-page` and is deployed by `.github/workflows/deploy-landing-page.yml`.

Deployment resources are managed through Terraform in `infra`:

```bash
cd infra
terraform init -backend-config="bucket=<gcp-project-id>-terraform-state" -backend-config="prefix=terraform/state/zapper"
terraform apply \
  -var="project_name=zapper" \
  -var="vercel_api_token=$VERCEL_API_TOKEN" \
  -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
  -var="cloudflare_zone_id=$CLOUDFLARE_ZONE_ID"
```

The workflow provisions the Vercel project/domain through Terraform, builds `@mp-lb/zapper-landing-page`, and deploys `apps/landing-page` with the Vercel CLI.

## Release CI Auth

Release publishing runs through `.github/workflows/release.yml`.

- The workflow is prepared for npm trusted publishing via GitHub Actions OIDC and can fall back to `secrets.NPM_TOKEN`.
- npm trusted publishing currently requires Node `22.14.0+` and npm CLI `11.5.1+`; the release workflow upgrades npm explicitly before publishing.
- npm currently requires either trusted publishing or a granular write token with **Bypass two-factor authentication** enabled for non-interactive package publishes.
- The release workflow passes `NPM_TOKEN` to `changesets/action` when the repository secret exists. If the secret is absent, Changesets can use OIDC trusted publishing.
- The release workflow logs the token length, a short SHA-256 token fingerprint, `npm whoami`, and package collaborator access before publishing. It does not print token characters.
- If release CI fails with `EOTP`, the configured `NPM_TOKEN` is not suitable for package publishing and must be replaced or removed after trusted publishing is set up on npm.
- Keep `packages/cli/package.json` `repository.url` aligned with the canonical GitHub repo because npm checks it for GitHub trusted publishing.
