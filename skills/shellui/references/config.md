# Config

## Modes (pick one)

1. `shellui.config.json` (preferred)
2. Split: `shellui.root.config.json`, `shellui.navigation.config.json`, … (no main JSON)
3. Legacy: `shellui.config.ts` → `shellui config migrate`

## Schema

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.config.schema.json"
}
```

Validated by `@shellui/core` at load. Invalid config fails with actionable errors.

## Location

Default: project root. Override with `--config <dir|file>` or `SHELLUI_CONFIG`. Project root still holds `static/` and `dist/`.

## Env placeholders

In string values: `${VAR}` or `${VAR:-default}`. Resolved by CLI before validation. On `shellui build`, values are frozen into the bundle — no runtime env fill in the browser.

## Public config

Config ships to the client. URLs and publishable keys only. Secrets belong on a real backend.

## Common keys

- `port`, `title`, `favicon`, `logo`, `layout` (`sidebar` | `fullscreen` | `windows` | `app-bar`), `language`
- `navigation[]` — `label`, `path`, `url`, optional `icon`, `openIn`, `requiresAuth`, …
- `backend` — `type` (`shellui` | `supabase`), `url`, …
- `themes` / `defaultTheme` — see https://docs.shellui.com/features/themes

Full field reference: https://docs.shellui.com/cli
