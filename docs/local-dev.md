# Local Development

Guide for contributing to zapper.

## Prerequisites

- Node.js 18+
- pnpm
- PM2 (`npm install -g pm2`)
- Docker (for testing docker services)

## Getting Started

```bash
npm uninstall --global zapper-cli  # Start fresh
pnpm add --global zapper-cli  # Make sure its installed with pnpm
pnpm install
pnpm build
pnpm link --global
```

After linking, your global `zap` command points to your local build. Make changes, run `pnpm build`, and test immediately.

## Linking & Unlinking

```bash
which zap                 # Should show pnpm global path
ls -la $(which zap)       # Should symlink to your dist/index.js

# Unlink when done
pnpm unlink --global
npm install --global zapper-cli  # Reinstall from npm
```

## Testing

```bash
pnpm test                        # Run all tests
pnpm test --watch                # Watch mode
pnpm test yaml-parser.test.ts    # Specific file
```

For manual testing, use the example projects in `examples/`. After building, cd into one and run `zap up`.

## Releases

### Normal release (CI, recommended)

1. Create changeset: `pnpm changeset` → pick bump → write summary
2. Open PR with the changeset and merge to `main`
3. Release PR opens automatically ("chore: release") — review and merge
4. Publish happens in CI. Verify: `npm view zapper-cli version`

### Local release (fallback)

```bash
pnpm changeset
pnpm changeset version
pnpm build
pnpm release
```

Always release via a changeset. Use semantic bumps: patch for fixes, minor for features, major for breaking changes.
