# Publishing Guide

This guide explains how to publish the ShellUI packages to npm.

## How publishing works

Publishing is done with a single script that:

1. Reads the **version** from the root `package.json`
2. Chooses the npm **dist-tag** from that version (so pre-releases don’t overwrite `latest`):
   - Version contains **`alpha`** (e.g. `0.2.0-alpha.0`) → `--tag alpha`
   - Version contains **`beta`** (e.g. `0.2.0-beta.1`) → `--tag beta`
   - Otherwise → `--tag latest`
3. Publishes packages in dependency order: **SDK → Core → CLI**

You must use **alpha** or **beta** in the version string when publishing pre-releases so the correct tag is used automatically.

## Prerequisites

1. Log in to npm:

   ```bash
   npm login
   ```

2. Set the version in the **root** `package.json`. For pre-releases, include `alpha` or `beta` in the version (e.g. `0.2.0-alpha.0`, `1.0.0-beta.1`).

3. Sync the version to all packages:

   ```bash
   pnpm run version:sync
   ```

4. Build before publishing:

   ```bash
   pnpm run build
   ```

## Publish all packages

From the repo root:

```bash
pnpm run publish
```

This runs `scripts/publish-with-tag.js`, which publishes `@shellui/sdk`, `@shellui/core`, and `@shellui/cli` in order with the tag derived from the root version. You don’t need to pass the tag manually.

## Version management

1. **Bump the root version** in `package.json` (e.g. `0.2.0-alpha.0` → `0.2.0-alpha.1`).
2. **Sync to all packages:**

   ```bash
   pnpm run version:sync
   ```

3. **Publish:**

   ```bash
   pnpm run publish
   ```

For stable releases, use a version without `alpha` or `beta` (e.g. `1.0.0`); it will be published with tag `latest`.

## Testing before publishing

1. Build and link locally:

   ```bash
   pnpm run build
   cd packages/cli
   pnpm link --global
   ```

2. In another project:

   ```bash
   pnpm link --global @shellui/cli
   shellui --version
   ```

## Troubleshooting

- **"Package already exists"**: This version is already on npm. Bump the version and run `pnpm run version:sync` before publishing again.
- **"Access denied"**: Ensure you’re logged in (`npm login`) and have publish access to the `@shellui` scope.
- **Wrong tag on npm**: Check that the root version contains `alpha` or `beta` for pre-releases; the script uses only the version string to pick the tag.
- **"Missing files"**: Check the `files` field in each package’s `package.json`.
