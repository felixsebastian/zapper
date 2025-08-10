## Releases

### Normal release (CI, recommended)
1. **Create changeset**: `pnpm changeset` → pick bump → write summary.
2. **Open PR** with the changeset and merge to `main`.
3. **Release PR opens automatically** ("chore: release"). Review and merge it.
4. **Publish happens in CI**. Verify: `npm view <package-name> version`.

### Local release (fallback)
1. `pnpm changeset`
2. `pnpm changeset version`
3. `pnpm build`
4. `pnpm release`  # runs Changesets publish (uses npm token if available)

Notes
- Always release via a changeset. Do not run `npm publish` directly.
- Use semantic bumps: patch for fixes, minor for features, major for breaking changes. 