---
title: Develop this monorepo
sidebar_label: Development
description: 'Install pnpm, build @shellui/cli, @shellui/core, and @shellui/sdk, and run tests in the Shellui repository.'
---

This repository is the CLI, core, and SDK workspace. Use it when you change Shellui itself. App authors should follow [Create a project](/quickstart) with the published CLI.

```text
.
├── packages/
│   ├── cli/
│   ├── core/
│   └── sdk/
├── docs/
├── tools/
└── package.json
```

Agent skills live in the sibling repo [shellui/skills](https://github.com/shellui/skills) (`../skills`). When you change public CLI, SDK, or config behavior, update the matching skill there and keep it small - see [ADR 0001](/adr/ai-skill).

## Workflow

This project uses [pnpm](https://pnpm.io/) 9 (`packageManager` in root `package.json`).

```bash
npm install -g pnpm
pnpm install
pnpm run build
```

Individual packages:

```bash
pnpm run build:cli
pnpm run build:core
pnpm run build:sdk
```

Tests:

```bash
pnpm test
```

`@shellui/cli` depends on `@shellui/core`. `@shellui/core` depends on `@shellui/sdk`. Workspace links mean a core change is visible to the CLI without publishing.

Useful root scripts: `pnpm start` / `pnpm run serve` (CLI `start`), `pnpm run docs:start`, `pnpm run tauri:dev`. See the root README for the full list. Format and lint: `pnpm run format`, `pnpm run lint`.
