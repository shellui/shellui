---
title: ADR 0001 — Official shellui AI skill
---

# ADR 0001: Official shellui AI skill

## Status

Accepted (amended: dedicated skills repo)

## Context

AI coding agents often mis-spell the product, invent local overlays instead of using `@shellui/sdk`, and guess wrong config/CLI flows. We need an official [Agent Skills](https://agentskills.io/specification)–compatible skill that is easy to install/update and cheap on tokens. Multiple Shellui-related repos (microservices, apps) need the same skill(s); more skills will be added over time.

## Decision

### Format

Ship a standard Agent Skill folder: `SKILL.md` (required) plus short `references/` and optional `assets/`. Portable frontmatter only (`name`, `description`, `license`, `metadata`). No Cursor-only fields.

### Hosting

**Dedicated repo:** [shellui/skills](https://github.com/shellui/skills) (local sibling: `../skills` next to this monorepo).

Catalog layout: `skills/<name>/` (e.g. `skills/shellui/`). Consumers install into `.agents/skills/` or `.cursor/skills/` (or via the skills CLI).

### Versioning

- Skill SemVer in each skill’s `metadata.version` + that skill’s `CHANGELOG.md`, independent of npm package versions.
- `metadata.shellui` records the package range the skill targets (e.g. `>=0.5.0`).
- On CLI/SDK/config breaking changes, update the skill in **shellui/skills** (same release cycle; cross-repo PR is fine).

### Install and update

Primary:

```bash
npx skills add shellui/skills --skill shellui
# many local apps: add -g
npx skills update
```

Manual: copy from [shellui/skills](https://github.com/shellui/skills) `skills/shellui/` into `.agents/skills/shellui/` or `.cursor/skills/shellui/`.

No `shellui skill install` CLI in v1.

### Sync with releases

Deep API detail stays in official docs (`https://docs.shellui.com`). The skill holds procedures and hard rules agents get wrong. Publishing checklist: if the release changes agent-relevant APIs or config, update [shellui/skills](https://github.com/shellui/skills) and bump that skill’s changelog.

### Token budget

Keep skills small. Prefer bullets over prose. Target `SKILL.md` under ~150 lines / ~2k tokens; each reference under ~80 lines. When adding content, delete or shorten something else unless the new fact prevents a real agent failure. Do not dump docs into the skill.

### Hard rules encoded in the shellui skill

1. **Naming**: never `ShellUI` / `shellUI` / `ShellUi`; only `shellui` or `Shellui`.
2. **Overlays**: embedded apps use `@shellui/sdk` for drawers, modals, toasts, and dialogs (not local chrome). Tiny is theme/language/nav only.

## Consequences

- One install path works across Agent Skills clients and across many Shellui-related repos.
- Discoverable via `npx skills` / skills.sh from `shellui/skills`.
- Maintainers must update the skills repo when public APIs break (not only this monorepo).
- Completeness is sacrificed for token cost; agents should open docs URLs for depth.

## Alternatives considered

| Option                           | Why not                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| Keep skill only in this monorepo | Harder multi-repo install story; catalog grows beyond one skill |
| npm package for the skill        | Ecosystem expects folders + git, not npm                        |
| `shellui skill install`          | Duplicates `npx skills`; defer                                  |
| Auto-generate from schema        | Out of scope; revisit later                                     |
