# Direct Changesets Releases for npm Packages

This guide describes how to set up an npm package so that a commit containing a
Changesets changeset releases directly from `main`.

The release shape is:

1. A developer changes code and docs.
2. The developer runs `pnpm changeset` and commits the generated
   `.changeset/*.md` file.
3. The commit lands on `main`.
4. GitHub Actions runs `changeset version` in CI.
5. CI runs release checks.
6. CI commits the generated version, changelog, lockfile, and removed changeset.
7. CI publishes to npm.
8. CI pushes the generated release commit and git tags back to `main`.

No "Version Packages" pull request is created in this flow.

## When to Use This

Use this for packages where merging to `main` is already the release approval.
This works for a single-package repo or a monorepo with one or more publishable
packages.

Do not use this if you want a human to review the exact version bump and
changelog in a separate release PR before anything publishes. The standard
`changesets/action` flow is better for that.

## Prerequisites

- A GitHub repository using GitHub Actions.
- A package manager. The examples use `pnpm`.
- A publishable package with a valid `package.json`.
- An npm account or organization with publish rights for the package name.
- npm trusted publishing configured for the package, or an npm automation token.

Prefer npm trusted publishing with GitHub Actions OIDC. It avoids long-lived
publish tokens. Current npm trusted publishing requirements include npm CLI
`11.5.1+`, Node `22.14.0+`, GitHub-hosted runners, and `id-token: write` in the
workflow. npm also requires the package's `repository.url` to match the GitHub
repository. See:

- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/cli/v11/commands/npm-trust/

Important first-publish note: npm trusted publisher configuration requires the
package to already exist on the npm registry. For a brand-new package name, do a
one-time manual publish first, then configure trusted publishing.

## Add or Prepare the Package

For a single-package repo, the root `package.json` can be the package.

For a monorepo, put the package under a workspace folder such as:

```text
packages/my-package/
  package.json
  src/
  README.md
```

The package must have a real `name`, `version`, build output, and package files.
Example package metadata:

```json
{
  "name": "@my-org/my-package",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/my-org/my-repo.git"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "release:check": "pnpm typecheck && pnpm test && pnpm build"
  }
}
```

For a scoped public package, keep `publishConfig.access` set to `public`.

## Set Up the Workspace

Install Changesets:

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

For a monorepo, make sure the package is included in `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

Add root scripts:

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "changeset publish"
  }
}
```

Use this baseline `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@2.3.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

In a monorepo, put private apps, servers, and testbenches in `ignore` so
Changesets only tries to version and publish the packages that belong on npm:

```json
{
  "ignore": [
    "@my-org/web-app",
    "@my-org/docs-site",
    "@my-org/testbench"
  ]
}
```

Do not ignore the package you intend to publish.

## Configure npm Trusted Publishing

After the package exists on npm, configure a trusted publisher for the package.

Using the npm website:

1. Open the package on npmjs.com.
2. Go to package settings.
3. Add a trusted publisher.
4. Choose GitHub Actions.
5. Set the repository owner, repository name, and workflow filename.

Using the npm CLI:

```bash
npm install -g npm@^11.10.0
npm trust github @my-org/my-package --repo my-org/my-repo --file release.yml
```

The workflow filename is only the basename under `.github/workflows/`, such as
`release.yml`.

If the package uses private dependencies, trusted publishing only handles
`npm publish`. You still need a read-only npm token for `pnpm install` or
`npm ci`.

## Add the Release Workflow

Create `.github/workflows/release.yml`.

This template assumes:

- `main` is the release branch.
- The publishable package is `@my-org/my-package`.
- The package lives at `packages/my-package`.
- The package has `release:check`.
- npm trusted publishing is configured for this workflow.

```yaml
name: Release

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'workflow_dispatch' || github.actor != 'github-actions[bot]' }}
    concurrency:
      group: release-${{ github.ref }}
      cancel-in-progress: true

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect pending changesets
        id: changesets
        shell: bash
        run: |
          count=$(find .changeset -maxdepth 1 -type f -name "*.md" ! -name "README.md" | wc -l | tr -d " ")
          echo "count=$count" >> "$GITHUB_OUTPUT"

          if [ "$count" = "0" ]; then
            echo "No pending changesets. Nothing to release."
          fi

      - name: Set up pnpm
        if: ${{ steps.changesets.outputs.count != '0' }}
        uses: pnpm/action-setup@v4

      - name: Set up Node.js
        if: ${{ steps.changesets.outputs.count != '0' }}
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          registry-url: "https://registry.npmjs.org/"
          scope: "@my-org"

      - name: Upgrade npm for trusted publishing
        if: ${{ steps.changesets.outputs.count != '0' }}
        run: npm install -g npm@^11.5.1

      - name: Install dependencies
        if: ${{ steps.changesets.outputs.count != '0' }}
        run: pnpm install --frozen-lockfile

      - name: Apply Changesets version
        if: ${{ steps.changesets.outputs.count != '0' }}
        run: pnpm changeset version

      - name: Release check
        if: ${{ steps.changesets.outputs.count != '0' }}
        run: pnpm --filter=@my-org/my-package release:check

      - name: Commit version changes
        if: ${{ steps.changesets.outputs.count != '0' }}
        shell: bash
        run: |
          version=$(node -p "JSON.parse(require('fs').readFileSync('packages/my-package/package.json', 'utf8')).version")

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .changeset packages/my-package/package.json packages/my-package/CHANGELOG.md pnpm-lock.yaml
          git commit -m "chore: release @my-org/my-package@${version} [skip ci]"

      - name: Publish
        if: ${{ steps.changesets.outputs.count != '0' }}
        run: pnpm release

      - name: Push release commit and tags
        if: ${{ steps.changesets.outputs.count != '0' }}
        run: git push origin "HEAD:${GITHUB_REF_NAME}" --follow-tags
```

For a single-package repo, adjust paths in the `version` command and `git add`:

```bash
version=$(node -p "require('./package.json').version")
git add .changeset package.json CHANGELOG.md pnpm-lock.yaml
```

For npm-token publishing instead of trusted publishing, remove `id-token: write`
and set publish env vars:

```yaml
      - name: Publish
        if: ${{ steps.changesets.outputs.count != '0' }}
        run: pnpm release
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Prefer trusted publishing when available.

## Optional: Push a Separate Product Tag

Changesets creates package tags such as:

```text
@my-org/my-package@1.2.3
```

If another workflow expects `v1.2.3` tags, create one explicitly before the
final push:

```yaml
      - name: Create v tag
        if: ${{ steps.changesets.outputs.count != '0' }}
        shell: bash
        run: |
          version=$(node -p "JSON.parse(require('fs').readFileSync('packages/my-package/package.json', 'utf8')).version")
          git tag "v${version}"
```

Then the existing `git push --follow-tags` step pushes both the Changesets tag
and the `v*` tag.

## Optional: Main Prereleases

Some repos publish every non-release package change to a `main` npm dist-tag.
That is a separate workflow from stable releases.

The usual rule is:

- If a push contains a pending changeset, skip the prerelease workflow and let
  the stable release workflow publish `latest`.
- If a push changes package code but has no changeset, publish a unique
  prerelease version such as `1.2.3-main.<run>.<attempt>` to the `main` tag.

Only add this if consumers need bleeding-edge builds.

## Daily Release Workflow

For normal package changes:

```bash
pnpm changeset
git add .
git commit -m "your change"
git push origin main
```

After pushing:

```bash
gh run list --workflow release.yml --branch main --limit 5
gh run watch <run-id> --exit-status
npm view @my-org/my-package version
```

The release is not complete until:

- the workflow exits 0
- npm shows the new version
- the generated release commit is visible on `main`
- the expected git tags exist

## Common Failure Modes

- No release happened: the push did not include a `.changeset/*.md` file.
- Publish failed with auth errors: trusted publisher package, repo, workflow
  filename, or `repository.url` does not match.
- Publish failed on a brand-new package: publish it once manually, then configure
  trusted publishing.
- CI could not push the release commit: branch protection blocks
  `github-actions[bot]`, or workflow permissions do not include
  `contents: write`.
- `CHANGELOG.md` missing from commit: either let `git add` include it or remove
  it from the command if the package intentionally does not generate one.
- Re-run tries to publish an existing version: npm never allows overwriting a
  version. Fix the repo state, create a new changeset if needed, and release a
  new version.

## Why Not `changesets/action`?

`changesets/action` is excellent when you want the normal Changesets release PR:
pending changesets on `main` create or update a "Version Packages" PR, and
publishing happens after that PR is merged.

This guide intentionally avoids that action. It runs the Changesets CLI directly
so the pending changeset commit itself is the release trigger.
