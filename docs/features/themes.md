# Themes

Shellui theming follows the [shadcn/ui](https://ui.shadcn.com/) CSS variable model (light under `:root`, dark under `.dark`). Tokens are **full CSS colors** — prefer **OKLCH** (`oklch(...)`). Configuration lives in `shellui.config` (no live theme editor yet).

## Quick start

`shellui init` injects the official Shellui theme:

```json
{
  "theme": "shellui"
}
```

## Built-in themes

Two curated themes ship as versioned JSON (`version: 1`) in `@shellui/core`:

| Name      | Label   | Source                                          |
| --------- | ------- | ----------------------------------------------- |
| `shellui` | Shellui | Official gold brand (shellui.com) — **default** |
| `claude`  | Claude  | Warm terracotta with Outfit + Geist Mono        |

```ts
import {
  defaultTheme, // === themes.shellui
  themes,
  themeNames, // ["shellui", "claude"]
  shelluiTheme,
  claudeTheme,
} from '@shellui/core';
```

JSON sources live under `packages/core/src/features/theme/curated/*.json` and are validated against `@shellui/core/schemas/shellui.theme.schema.json`.

## Config API

### 1) Single built-in theme by name

```json
{
  "theme": "shellui"
}
```

### 2) Inline theme object (full or partial override)

Partial `light` / `dark` tokens merge onto the Shellui theme. CamelCase or CSS-variable kebab-case keys are accepted (`primary-foreground`, `sidebar`, …):

```ts
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  theme: {
    name: 'brand',
    label: 'Brand',
    radius: '0.5rem',
    fonts: { sans: 'Inter, system-ui, sans-serif' },
    light: {
      primary: 'oklch(0.55 0.15 250)',
      'primary-foreground': 'oklch(1 0 0)',
    },
    dark: {
      primary: 'oklch(0.7 0.12 250)',
    },
  },
};
```

### 3) Theme folder (`themesDir`)

```json
{
  "themesDir": "./themes",
  "theme": "acme"
}
```

```
themes/
  acme.json
  acme/
    fonts/
      Inter-Regular.woff2
```

Theme JSON must include `"version": 1` and pass the theme schema.

### 4) Multiple themes

```json
{
  "themes": ["shellui", "claude"],
  "activeTheme": "shellui"
}
```

Or a map of id → name | path | object. `defaultTheme` remains an alias of `activeTheme`. Legacy `theme: "default"` resolves to `shellui`.

## Theme JSON shape (version 1)

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.theme.schema.json",
  "version": 1,
  "name": "acme",
  "label": "Acme",
  "description": "Acme brand theme",
  "recommended": false,
  "radius": "0.5rem",
  "fonts": {
    "sans": "Outfit, sans-serif",
    "mono": "Geist Mono, monospace",
    "files": ["https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap"]
  },
  "light": {
    "background": "oklch(0.98 0.005 95)",
    "foreground": "oklch(0.34 0.027 96)",
    "primary": "oklch(0.62 0.14 39)",
    "sidebarBackground": "oklch(0.97 0.008 99)"
  },
  "dark": {
    "background": "oklch(0.27 0.004 107)",
    "foreground": "oklch(0.96 0.003 106)",
    "primary": "oklch(0.67 0.13 39)"
  }
}
```

Paste from shadcn CSS by mapping `:root` / `.dark` variables into `light` / `dark` (kebab-case keys work).

## How colors apply

The shell sets CSS variables as **full colors** on `:root`. Tailwind consumes them with `var(--background)` (not `hsl(var(--background))`). Hex and legacy HSL channel triples are still accepted and normalized.

## Theme selector UI

Settings → Appearance scales with the number of available themes (1 / few / many). Recommended themes sort first. Fonts from a theme’s `fonts.files` apply when that theme is active.

## Related

- [Layouts](/features/layouts)
- [Application settings](/features/application-settings)
- [CLI](/cli)
