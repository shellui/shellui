---
title: ADR 0001 — Official shellui AI skill
---

# ADR 0001: Official shellui AI skill

## Status

Accepted

## Context

AI coding agents often mis-spell the product, invent local overlays instead of using `@shellui/sdk`, and guess wrong config/CLI flows. We need an official [Agent Skills](https://agentskills.io/specification)–compatible skill that is easy to install/update and cheap on tokens.

## Decision

### Format

Ship a standard Agent Skill folder: `SKILL.md` (required) plus short `references/` and optional `assets/`. Portable frontmatter only (`name`, `description`, `license`, `metadata`). No Cursor-only fields.

### Hosting

Live in this monorepo at `skills/shellui/` so the skill stays next to packages and docs. Consumers install into `.agents/skills/` or `.cursor/skills/` (or via the skills CLI). Source of truth is not those consumer paths.

### Versioning

- Skill SemVer in `metadata.version` + `skills/shellui/CHANGELOG.md`, independent of npm package versions.
- `metadata.shellui` records the package range the skill targets (e.g. `>=0.5.0`).
- On CLI/SDK/config breaking changes, update the skill in the same PR.

### Install and update

Primary:

```bash
npx skills add shellui/shellui --skill shellui
npx skills update
```

Manual: copy `skills/shellui/` into `.agents/skills/shellui/` or `.cursor/skills/shellui/` (or `~` equivalents for user-global).

No `shellui skill install` CLI in v1.

### Sync with releases

Deep API detail stays in official docs (`https://docs.shellui.com`). The skill holds procedures and hard rules agents get wrong. Publishing checklist: if the release changes agent-relevant APIs or config, update `skills/shellui` and bump its changelog.

### Token budget

Keep the skill small. Prefer bullets over prose. Target `SKILL.md` under ~150 lines / ~2k tokens; each reference under ~80 lines. When adding content, delete or shorten something else unless the new fact prevents a real agent failure. Do not dump docs into the skill.

### Hard rules encoded in the skill

1. **Naming**: never `ShellUI` / `shellUI` / `ShellUi`; only `shellui` or `Shellui`.
2. **Overlays**: embedded apps use `@shellui/sdk` for drawers, modals, toasts, and dialogs (not local chrome). Tiny is theme/language/nav only.

## Consequences

- One install path works across Agent Skills clients (Cursor, Claude Code, etc.).
- Discoverable via `npx skills` / skills.sh from the public GitHub repo.
- Maintainers must treat skill updates as part of breaking-change PRs.
- Completeness is sacrificed for token cost; agents should open docs URLs for depth.

## Alternatives considered

| Option                          | Why not for v1                                        |
| ------------------------------- | ----------------------------------------------------- |
| Dedicated `shellui/skills` repo | Extra sync overhead; monorepo is enough for one skill |
| npm package for the skill       | Ecosystem expects folders + git, not npm              |
| `shellui skill install`         | Duplicates `npx skills`; defer                        |
| Auto-generate from schema       | Out of scope; revisit later                           |
