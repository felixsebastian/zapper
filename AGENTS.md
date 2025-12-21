# Zapper

A lightweight dev environment runner. Define your local dev setup in a single `zap.yaml` file and boot everything with `zap up`. Delegates to PM2 for processes, Docker for containers, and asdf for runtime versioning.

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
