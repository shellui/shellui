---
title: Publish npm packages
sidebar_label: Publishing
description: 'Publish a GitHub release and GitHub Actions ships the SDK, core, and CLI to npm with the right dist-tag.'
---

Publish `@shellui/sdk`, `@shellui/core`, and `@shellui/cli` by publishing a GitHub release.

## Steps

Releases are published to npm by GitHub Actions. Nobody needs an npm token or `npm login`.

1. Bump the root `package.json` version, run `pnpm run version:sync`, and add the release to `CHANGELOG.md` (`## [x.y.z] - YYYY-MM-DD`).
2. Merge `develop` into `main`.
3. Create a GitHub release on `main` with the tag `vx.y.z` and the changelog entry as its description.

Publishing the release runs [`.github/workflows/publish-npm.yml`](https://github.com/shellui/shellui/blob/main/.github/workflows/publish-npm.yml) in the `npm` environment, which only accepts `v*` tags. The workflow:

- fails if the tag does not match the root and package versions
- runs the changelog check, lint, tests and the build
- packs each package (this turns `workspace:*` into the real version) and publishes `@shellui/sdk`, `@shellui/core` and `@shellui/cli` in that order
- uses dist-tag `alpha` or `beta` for prerelease versions (`0.9.0-alpha.0`, `0.9.0-beta.1`) and `latest` otherwise
- skips a package whose version is already on npm, so a failed run can be rerun safely

npm trusted publishing (OIDC) authenticates the workflow, and every version gets a provenance attestation linking it to the commit and run. On npmjs.com, each package trusts the `shellui/shellui` repository, the `publish-npm.yml` workflow and the `npm` environment.

Run `pnpm run changelog:check` on its own to validate the changelog before you start.

`pnpm run publish` still works from a local machine after `npm login` as a fallback.

If the release changes agent-relevant APIs or config, update the matching skill in [shellui/skills](https://github.com/shellui/skills), bump `metadata.version` and that skill's `CHANGELOG.md`, and keep the skill lean - see [ADR 0001](/adr/ai-skill).

## Test the CLI locally

```bash
pnpm run build
cd packages/cli
pnpm link --global
```

In another project:

```bash
pnpm link --global @shellui/cli
shellui --version
```

## Failures

- **"Package already exists":** the workflow skips that package; for a new release, bump the version and `pnpm run version:sync`
- **"Access denied" or OIDC errors:** check the trusted publisher settings for each package on npmjs.com
- **Wrong tag:** check that the root version contains `alpha` or `beta` for pre-releases
- **"CHANGELOG.md is not ready":** rename the top release heading to the root version with today's date, and move any `## [Unreleased]` notes into it
- **"Missing files":** check the `files` field in each package `package.json`
