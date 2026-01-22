# Releases

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

## Creating a Release

1. **Add a changeset** for your changes:
   ```bash
   pnpm changeset
   ```
   Follow the prompts to select the version bump type (patch/minor/major) and describe the changes.

2. **Commit and push** the changeset file along with your code changes.

3. **Open a PR** and merge to `main`.

4. The Changesets GitHub Action will automatically create a "Version Packages" PR that bumps versions and updates CHANGELOG.md.

5. **Merge the Version Packages PR** to trigger the npm publish.

## Manual Release (if needed)

```bash
pnpm version    # Apply changesets and bump versions
pnpm release    # Publish to npm
```
