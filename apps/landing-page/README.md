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

## Deployment

Deployment is managed from the main repo:

- Terraform resources live in `infra`.
- GitHub Actions workflow: `.github/workflows/deploy-web.yml`.
- The workflow provisions the Vercel projects/domains for the landing page and docs site, builds both, and deploys them with the Vercel CLI.

## Mac Download Route

`/download/mac` redirects to the latest GitHub Release asset whose filename
contains `macOS` and ends in `.zip`. Set `DESKTOP_RELEASES_GITHUB_TOKEN`,
`GITHUB_RELEASE_TOKEN`, or `GITHUB_TOKEN` in the hosting environment to raise
GitHub API limits or access private releases. Set `ZAPPER_GITHUB_REPO` to
override the default `mp-lb/zapper` repository.

The production deployment can receive the token from the GitHub Actions secret
`PRODUCTION_SECRETS`, formatted as an env file containing
`DESKTOP_RELEASES_GITHUB_TOKEN`. Terraform stores it as a Vercel project
environment variable for the landing page.
