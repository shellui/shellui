# Publishing Guide

This guide explains how to publish the Shellui packages to npm.

## How publishing works

Releases are published to npm by GitHub Actions. Nobody needs an npm token or `npm login`.

1. Bump the root `package.json` version, run `pnpm run version:sync`, and add the release to `CHANGELOG.md` (`## [x.y.z] - YYYY-MM-DD`).
2. Merge `develop` into `main`.
3. Create a GitHub release on `main` with the tag `vx.y.z` and the changelog entry as its description.

Publishing the release runs [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml) in the `npm` environment, which only accepts `v*` tags. The workflow:

- fails if the tag does not match the root and package versions
- runs the changelog check, lint, tests and the build
- packs each package (this turns `workspace:*` into the real version) and publishes `@shellui/sdk`, `@shellui/core` and `@shellui/cli` in that order
- uses dist-tag `alpha` or `beta` for prerelease versions (`0.9.0-alpha.0`, `0.9.0-beta.1`) and `latest` otherwise
- skips a package whose version is already on npm, so a failed run can be rerun safely

npm trusted publishing (OIDC) authenticates the workflow, and every version gets a provenance attestation linking it to the commit and run. On npmjs.com, each package trusts the `shellui/shellui` repository, the `publish-npm.yml` workflow and the `npm` environment.

The changelog check stops the release unless the root version is `x.y.z`, `x.y.z-alpha.N` or `x.y.z-beta.N`, `CHANGELOG.md` has no active `## [Unreleased]` section, and the topmost release heading is `## [<root version>] - YYYY-MM-DD`.

## Manual fallback

`pnpm run publish` (`scripts/publish-with-tag.js`) still publishes from a local machine after `npm login`, with the same checks and order. Use it only if the workflow cannot run.

## AI skill

If this release changes agent-relevant APIs or config (CLI, SDK, config schema), update the matching skill in [shellui/skills](https://github.com/shellui/skills), bump `metadata.version` and that skill’s `CHANGELOG.md`, and keep the skill lean (see [docs/adr/0001-ai-skill.md](docs/adr/0001-ai-skill.md)).

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

- **"Package already exists"**: This version is already on npm. The workflow skips it; for a new release, bump the version and run `pnpm run version:sync`.
- **"Access denied" or OIDC errors in the workflow**: Check the trusted publisher settings on npmjs.com for each package (repository `shellui/shellui`, workflow `publish-npm.yml`, environment `npm`).
- **Wrong tag on npm**: Check that the root version contains `alpha` or `beta` for pre-releases; the script uses only the version string to pick the tag.
- **"Missing files"**: Check the `files` field in each package’s `package.json`.
- **"CHANGELOG.md is not ready"**: Rename the top release heading to the root version with today's date, and move any `## [Unreleased]` notes into it.
