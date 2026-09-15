---
title: Publish npm packages
sidebar_label: Publishing
description: Sync versions, build, and run pnpm run publish so SDK, core, and CLI ship with the correct npm dist-tag.
---

Publish `@shellui/sdk`, `@shellui/core`, and `@shellui/cli` with one script. The npm dist-tag comes from the **root** `package.json` version:

- Version contains `alpha` (for example `0.2.0-alpha.0`) → tag `alpha`
- Version contains `beta` (for example `0.2.0-beta.1`) → tag `beta`
- Otherwise → tag `latest`

Put `alpha` or `beta` in the version string for pre-releases so `latest` is not overwritten.

## Steps

1. `npm login`
2. Set the version in the root `package.json`
3. Sync packages: `pnpm run version:sync`
4. Build: `pnpm run build`
5. From the repo root: `pnpm run publish`

That runs `scripts/publish-with-tag.js` in order SDK → Core → CLI. You do not pass the tag by hand.

For a later bump: change the root version, `pnpm run version:sync`, `pnpm run publish`. Stable releases omit `alpha` / `beta`.

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

- **"Package already exists":** bump the version and `pnpm run version:sync` before publishing again
- **"Access denied":** `npm login` and publish rights on `@shellui`
- **Wrong tag:** check that the root version contains `alpha` or `beta` for pre-releases
- **"Missing files":** check the `files` field in each package `package.json`
