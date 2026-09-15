---
id: ai-skill
slug: /adr/ai-skill
title: ADR 0001 - Official shellui skill
sidebar_label: ADR 0001
description: Decision record for hosting the official Agent Skill in shellui/skills, versioning, and token budget.
---

Accepted (amended: dedicated skills repo).

## Context

Coding agents misspell the product, invent local overlays instead of `@shellui/sdk`, and guess wrong config and CLI flows. Shellui ships an official [Agent Skills](https://agentskills.io/specification)-compatible skill that stays small on tokens. Multiple Shellui-related repos (services, apps) need the same skill. More skills will be added over time.

## Decision

### Format

Ship a standard Agent Skill folder: `SKILL.md` (required) plus short `references/` and optional `assets/`. Portable frontmatter only (`name`, `description`, `license`, `metadata`). No Cursor-only fields.

### Hosting

Dedicated repo: [shellui/skills](https://github.com/shellui/skills) (local sibling: `../skills`).

Catalog layout: `skills/<name>/` (for example `skills/shellui/`). Consumers install into `.agents/skills/` or `.cursor/skills/` (or via the skills CLI).

### Versioning

- Skill SemVer in each skill's `metadata.version` plus that skill's `CHANGELOG.md`, independent of npm package versions
- `metadata.shellui` records the package range the skill targets (for example `>=0.5.0`)
- On CLI/SDK/config breaking changes, update the skill in **shellui/skills** in the same release cycle (cross-repo PR is fine)

### Install and update

```bash
npx skills add shellui/skills --skill shellui
npx skills add shellui/skills --skill shellui -g
npx skills update
```

Manual: copy `skills/shellui/` from [shellui/skills](https://github.com/shellui/skills) into `.agents/skills/shellui/` or `.cursor/skills/shellui/`.

No `shellui skill install` CLI in v1.

### Sync with releases

Deep API detail stays at [docs.shellui.com](https://docs.shellui.com). The skill holds procedures and hard rules agents get wrong. Publishing checklist: if the release changes agent-relevant APIs or config, update [shellui/skills](https://github.com/shellui/skills) and bump that skill's changelog.

### Token budget

Keep skills small. Prefer bullets over prose. Target `SKILL.md` under ~150 lines / ~2k tokens; each reference under ~80 lines. When adding content, delete or shorten something else unless the new fact prevents a real agent failure. Do not dump docs into the skill.

### Hard rules in the shellui skill

1. **Naming:** never `ShellUI` / `shellUI` / `ShellUi`; only `shellui` or `Shellui`
2. **Overlays:** embedded apps use `@shellui/sdk` for drawers, modals, toasts, and dialogs (not local chrome). Tiny is theme/language/nav only

## Consequences

- One install path works across Agent Skills clients and across Shellui-related repos
- Discoverable via `npx skills` / skills.sh from `shellui/skills`
- Maintainers must update the skills repo when public APIs break (not only this monorepo)
- Completeness is sacrificed for token cost; agents should open docs URLs for depth

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the skill only in this monorepo | Weaker multi-repo install; catalog grows beyond one skill |
| npm package for the skill | Ecosystem expects folders + git, not npm |
| `shellui skill install` | Duplicates `npx skills`; defer |
| Auto-generate from schema | Out of scope; revisit later |
