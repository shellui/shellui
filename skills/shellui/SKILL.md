---
name: shellui
description: >-
  Build and modify Shellui microfrontend shells — shellui.config.json,
  CLI init/dev/build, themes, navigation, layouts, backend/auth, and
  @shellui/sdk (drawers, modals, toasts, dialogs) vs tiny. Use when
  working on shellui projects, config, embedded iframe apps, or SDK
  integration. Never spell the product as ShellUI.
license: MIT
metadata:
  author: shellui
  version: '1.0.0'
  shellui: '>=0.5.0'
---

# shellui

## Hard rules

1. **Naming**: never `ShellUI`, `shellUI`, or `ShellUi`. Use `shellui` (packages, CLI, paths) or `Shellui` (proper name). Apply in code, comments, docs, and commits.
2. **Overlays from embedded apps**: use `@shellui/sdk` for drawers, modals, toasts, and dialogs. Do not invent local overlay UI. Tiny (`@shellui/sdk/tiny`) is theme / language / nav only — not overlays.
3. **Config is public**: no secrets in `shellui.config.json` (or split configs). Env `${VAR}` resolves at CLI load/build only.

## Mental model

Host shell (`@shellui/core` via CLI) embeds app URLs (often iframes). Shared nav, themes, auth, and overlays live in the shell. Child apps talk to the shell through `@shellui/sdk`.

## Workflow

```bash
npm i -D @shellui/cli          # or -g; Node >= 18
shellui init                   # shellui.config.json + $schema
# add static/favicon.svg, logo.svg, icons as needed
shellui start                  # alias: shellui dev
shellui build
```

In iframe apps: `npm i @shellui/sdk` → `await shellui.init()` → toast / dialog / openModal / openDrawer.

## SDK vs tiny

| Need                                        | Use                                          |
| ------------------------------------------- | -------------------------------------------- |
| toast, dialog, modal, drawer, auth, storage | `@shellui/sdk` + `init()`                    |
| theme / language / region / navigate only   | `@shellui/sdk/tiny` or CDN `shellui.tiny.js` |

## Config quick facts

- Prefer `shellui.config.json` with `$schema`: `./node_modules/@shellui/core/schemas/shellui.config.schema.json`
- Or split `shellui.<name>.config.json` (not both). Migrate TS: `shellui config migrate`
- `--config` / `SHELLUI_CONFIG` for non-root config dir
- Docs: https://docs.shellui.com/cli · https://docs.shellui.com/quickstart

## References

- [references/config.md](references/config.md)
- [references/cli.md](references/cli.md)
- [references/sdk.md](references/sdk.md)
- Example: [assets/shellui.config.example.json](assets/shellui.config.example.json)
- Features: https://docs.shellui.com (nav, themes, layouts, backend, auth)

## Anti-patterns

- Spelling the product `ShellUI`
- Local toast/modal/drawer libs inside iframe apps instead of the SDK
- Using tiny for overlays
- Secrets or private keys in config
- Ignoring `$schema` / inventing config fields
