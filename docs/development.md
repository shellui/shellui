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

Root scripts:

| Script                                        | What it does                                                 |
| --------------------------------------------- | ------------------------------------------------------------ |
| `pnpm start` / `pnpm run serve`               | Run the shell with the local CLI                             |
| `pnpm run build`                              | Build the shell to `dist/web/`                               |
| `pnpm run build:packages`                     | Build every workspace package                                |
| `pnpm run build:cli` / `pnpm run build:sdk`   | Build one package                                            |
| `pnpm run serve:dist`                         | Serve the production build with SPA routing                  |
| `pnpm test`                                   | Run the tests of every package                               |
| `pnpm run format` / `pnpm run lint`           | Format with Prettier, lint with ESLint                       |
| `pnpm run tauri:dev`                          | Run the desktop wrapper                                      |
| `pnpm run docs:start` / `pnpm run docs:build` | Fetch the service docs, then start or build the docs site    |
| `pnpm run publish`                            | Publish SDK, core and CLI with the dist-tag from the version |
| `pnpm run version:sync`                       | Copy the root version to every package                       |
| `pnpm run clean`                              | Remove every `node_modules`                                  |

The docs site also renders the service docs from `identity-service`, `storage-service`, `hosting-service`, and `email-service`. See [Docs site](/docs-site) for how they are fetched and how to edit them with live reload.
