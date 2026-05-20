# Zapper Landing Page

## Getting Started

```bash
pnpm dev:landing
```

Open [http://localhost:15383](http://localhost:15383) with your browser to see the result.

This app is part of the root pnpm workspace. Use root commands for normal validation:

```bash
pnpm --filter @mp-lb/zapper-landing-page lint
pnpm --filter @mp-lb/zapper-landing-page build
```

Do not commit a per-app `package-lock.json` here. The landing page deploy uses
the repo root pnpm workspace metadata (`package.json`, `pnpm-workspace.yaml`,
and `pnpm-lock.yaml`), and a stray npm lockfile can cause Vercel to pick the
wrong package manager during deployment.

## Deployment

Deployment is managed from the main repo:

- Terraform resources live in `infra`.
- GitHub Actions workflow: `.github/workflows/deploy-web.yml`.
- The workflow provisions the Vercel projects/domains for the landing page and docs site, builds both, and deploys them with the Vercel CLI.

## Mac Download Route

`/download/mac` redirects to the latest GitHub Release asset whose filename
is `Zapper-macOS.zip`, falling back to any `macOS` zip asset. If GitHub API
lookup fails, it redirects to GitHub's stable latest-release download URL for
`Zapper-macOS.zip`. Set `DESKTOP_RELEASES_GITHUB_TOKEN`,
`GITHUB_RELEASE_TOKEN`, or `GITHUB_TOKEN` in the hosting environment to raise
GitHub API limits. Set `ZAPPER_GITHUB_REPO` to override the default
`mp-lb/zapper` repository.

The production deployment can receive the token from the GitHub Actions secret
`PRODUCTION_SECRETS`, formatted as an env file containing
`DESKTOP_RELEASES_GITHUB_TOKEN`. Terraform stores it as a Vercel project
environment variable for the landing page.
