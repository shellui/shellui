---
title: Configure themes
sidebar_label: Themes
description: 'Set theme, themes, or themesDir in shellui.config.json using shadcn CSS variables (OKLCH preferred).'
---

Theming follows the [shadcn/ui](https://ui.shadcn.com/) CSS variable model (light under `:root`, dark under `.dark`). Tokens are full CSS colors - prefer **OKLCH** (`oklch(...)`). There is no live theme editor; configuration lives in `shellui.config.json` (or theme JSON under `themesDir`).

`shellui init` sets the official palette:

```json
{
  "theme": "shellui"
}
```

The shell writes variables as full colors on `:root`. Tailwind consumes `var(--background)` (not `hsl(var(--background))`). Hex and legacy HSL channel triples are accepted and normalized.

Design palettes in [tweakcn](https://tweakcn.com) or any shadcn-compatible export, then map `:root` / `.dark` into `light` / `dark` (kebab-case keys work). Registry JSON (`cssVars.light` / `cssVars.dark`) maps the same way.

## Built-in themes

Curated JSON (`version: 1`) ships in `@shellui/core` (`packages/core/src/features/theme/curated/*.json`), validated against `@shellui/core/schemas/shellui.theme.schema.json`. Named exports (`shelluiTheme`, `claudeTheme`, `themeNames`, …) come from `@shellui/core`. Community palettes are adapted from tweakcn and shadcn/ui unless noted.

| Name              | Label           | Notes                                        |
| ----------------- | --------------- | -------------------------------------------- |
| `shellui`         | Shellui         | Official gold brand                          |
| `claude`          | Claude          | Warm terracotta, Outfit + Geist Mono         |
| `light-green`     | Light Green     | Lime primary, Inter + JetBrains Mono         |
| `zen-inspired`    | Zen Inspired    | Parchment neutrals, Inter + Playfair Display |
| `astro-vista`     | Astro Vista     | Cool neutrals, orange primary                |
| `shadcn`          | shadcn          | Default shadcn/ui neutrals, system fonts     |
| `amber-minimal`   | Amber Minimal   | White neutrals, amber primary                |
| `amethyst-haze`   | Amethyst Haze   | Lavender neutrals                            |
| `bold-tech`       | Bold Tech       | Violet primary                               |
| `bubblegum`       | Bubblegum       | Pink primary, candy pastels                  |
| `caffeine`        | Caffeine        | Coffee browns                                |
| `candyland`       | Candyland       | Pastel pink, blue, lime                      |
| `catppuccin`      | Catppuccin      | Mauve primary                                |
| `claymorphism`    | Claymorphism    | Clay surfaces, violet primary                |
| `clean-slate`     | Clean Slate     | Slate neutrals                               |
| `cosmic-night`    | Cosmic Night    | Soft violet                                  |
| `cyberpunk`       | Cyberpunk       | Magenta and cyan                             |
| `darkmatter`      | Darkmatter      | Amber primary, mono-first                    |
| `doom-64`         | Doom 64         | Retro game palette                           |
| `elegant-luxury`  | Elegant Luxury  | Burgundy                                     |
| `graphite`        | Graphite        | Greyscale                                    |
| `kodama-grove`    | Kodama Grove    | Moss greens                                  |
| `midnight-bloom`  | Midnight Bloom  | Violet bloom                                 |
| `mocha-mousse`    | Mocha Mousse    | Mocha browns                                 |
| `modern-minimal`  | Modern Minimal  | Blue primary                                 |
| `mono`            | Mono            | Geist Mono throughout                        |
| `nature`          | Nature          | Forest green                                 |
| `neo-brutalism`   | Neo Brutalism   | Bold blocks                                  |
| `northern-lights` | Northern Lights | Aurora green                                 |
| `notebook`        | Notebook        | Architects Daughter                          |
| `ocean-breeze`    | Ocean Breeze    | Teal primary                                 |
| `pastel-dreams`   | Pastel Dreams   | Lavender, large radius                       |
| `perpetuity`      | Perpetuity      | Teal terminal                                |
| `quantum-rose`    | Quantum Rose    | Rose primary                                 |
| `retro-arcade`    | Retro Arcade    | Magenta and teal                             |
| `sage-garden`     | Sage Garden     | Muted sage                                   |
| `soft-pop`        | Soft Pop        | Violet and teal                              |
| `solar-dusk`      | Solar Dusk      | Dusk oranges                                 |
| `starry-night`    | Starry Night    | Night blues, gold                            |
| `sunset-horizon`  | Sunset Horizon  | Sunset oranges                               |
| `supabase`        | Supabase        | Supabase green                               |
| `t3-chat`         | T3 Chat         | Magenta-rose                                 |
| `tangerine`       | Tangerine       | Tangerine on slate                           |
| `twitter`         | Twitter         | Sky blue                                     |
| `vercel`          | Vercel          | Black and white, Geist                       |
| `vintage-paper`   | Vintage Paper   | Aged paper                                   |
| `violet-bloom`    | Violet Bloom    | Bold violet                                  |

## Config shapes

**Single built-in name:**

```json
{
  "theme": "shellui"
}
```

**Inline object** (partial `light` / `dark` merges onto the Shellui theme; camelCase or kebab-case keys):

```typescript
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

**Folder of JSON themes:**

```json
{
  "themesDir": "./themes",
  "theme": "acme"
}
```

```text
themes/
  acme.json
  acme/
    fonts/
      Inter-Regular.woff2
```

Theme JSON must include `"version": 1` and pass the theme schema.

**Several themes** for the Settings picker:

```json
{
  "themes": ["shellui", "claude", "shadcn"],
  "activeTheme": "shellui"
}
```

Or a map of id → name | path | object. `defaultTheme` is an alias of `activeTheme`. Legacy `theme: "default"` resolves to `shellui`.

## Theme JSON (version 1)

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

## Theme selector

Settings → Appearance scales with how many themes you configured (1 / few / many). Recommended themes sort first. Each preview uses that theme's swatches, typography, and `radius`. Fonts from `fonts.files` apply when the theme is active.

Do not ship a second theme picker inside a hosted iframe unless that iframe **is** the settings surface. Read `settings.appearance` from the SDK instead.

## Related pages

- [tweakcn](https://tweakcn.com), [shadcn/ui themes](https://ui.shadcn.com/themes)
- [Layouts](/features/layouts), [Application settings](/features/application-settings), [CLI](/cli)
