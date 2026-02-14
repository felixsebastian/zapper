# Zapper

A lightweight dev environment runner. Define your local dev setup in a single `zap.yaml` file and boot everything with `zap up`. Delegates to PM2 for processes, Docker for containers.

**Core philosophy:** Processes are processes—you shouldn't need to care if something is native or containerized.

**Status:** WIP, basic start/stop of PM2 processes working.

## Documentation

- **[Usage](docs/usage.md)** — Comprehensive docs, keep this up to date
- **[Development](docs/development.md)** — To see how we run/test/build the app

## Development

Create example projects for testing:

```
./examples/myproj/zap.yaml
```

Remember to `pnpm build` and link (usually already linked). Then cd into the example project and zap away.

**Cleanup:** Stop processes and delete `.zap` folders when done.

## Commands

- `pnpm test` — run tests
- `pnpm build` — build the project
- `pnpm lint:fix` — fix linting issues

## Verification

Use this verification flow while developing:

- Lint after every small change: `pnpm lint` (or `pnpm lint:fix` to auto-fix).
- Run focused/unit tests as you go: `pnpm test <path-to-test-file>`.
- Run the normal test suite before wrapping up: `pnpm test`.
- Run end-to-end tests once near the end of a big change, when you think the work is done: one-time setup `bash ./etc/e2e_setup.sh`, then `pnpm test:e2e`.
