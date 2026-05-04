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
- GitHub Actions workflow: `.github/workflows/deploy-landing-page.yml`.
- The workflow provisions the Vercel project/domain, builds this app, and deploys it with the Vercel CLI.
