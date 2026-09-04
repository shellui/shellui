# Themes

Shellui theming follows the [shadcn/ui](https://ui.shadcn.com/) CSS variable model (light under `:root`, dark under `.dark`). Tokens are **full CSS colors** — prefer **OKLCH** (`oklch(...)`). Configuration lives in `shellui.config` (no live theme editor yet).

## Designing your own theme

Most curated themes below come from the excellent [tweakcn](https://tweakcn.com) — a perfect tool to create or customize a theme and export shadcn-compatible CSS variables. We highly encourage a [tweakcn Pro](https://tweakcn.com) subscription to support that project.

Any theme built for [shadcn/ui](https://ui.shadcn.com/themes) works beautifully with Shellui: paste `:root` / `.dark` variables into theme JSON (`light` / `dark`), or map a registry-style export the same way. Many other platforms also share ready-made shadcn themes you can adapt the same way.

When you are happy with a palette, save it as versioned theme JSON under `themesDir` (or inline in config) — see [Theme JSON shape](#theme-json-shape-version-1).

## Quick start

`shellui init` injects the official Shellui theme:

```json
{
  "theme": "shellui"
}
```

## Built-in themes

Curated themes ship as versioned JSON (`version: 1`) in `@shellui/core`. Community and brand palettes are adapted from [tweakcn](https://tweakcn.com) and [shadcn/ui](https://ui.shadcn.com/) unless noted otherwise:

| Name              | Label           | Description                                                                               |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `shellui`         | Shellui         | Official Shellui theme — gold brand from shellui.com                                      |
| `claude`          | Claude          | Warm terracotta theme with Outfit and Geist Mono                                          |
| `light-green`     | Light Green     | Bright lime primary on cool neutrals (Inter + JetBrains Mono)                             |
| `zen-inspired`    | Zen Inspired    | Warm parchment neutrals with charcoal primary (Inter + Playfair Display + JetBrains Mono) |
| `astro-vista`     | Astro Vista     | Soft cool neutrals with warm orange primary (Outfit + Merriweather + Fira Code)           |
| `shadcn`          | shadcn          | Default shadcn/ui neutral palette with system fonts                                       |
| `amber-minimal`   | Amber Minimal   | Clean white neutrals with amber primary (Inter + Source Serif 4 + JetBrains Mono)         |
| `amethyst-haze`   | Amethyst Haze   | Soft lavender neutrals with muted purple primary (Geist + Lora + Fira Code)               |
| `bold-tech`       | Bold Tech       | Vivid violet primary on cool lilac neutrals (Roboto + Playfair Display + Fira Code)       |
| `bubblegum`       | Bubblegum       | Playful pink primary with candy pastels (Poppins + Lora + Fira Code)                      |
| `caffeine`        | Caffeine        | Warm coffee browns with soft cream accents (system fonts)                                 |
| `candyland`       | Candyland       | Soft pastel pink, blue, and lime accents (Poppins + Roboto Mono)                          |
| `catppuccin`      | Catppuccin      | Mauve primary with cool lavender neutrals (Montserrat + Fira Code)                        |
| `claymorphism`    | Claymorphism    | Soft clay surfaces with violet primary (Plus Jakarta Sans + Lora + Roboto Mono)           |
| `clean-slate`     | Clean Slate     | Cool slate neutrals with violet primary (Inter + Merriweather + JetBrains Mono)           |
| `cosmic-night`    | Cosmic Night    | Soft violet cosmic palette (Inter + JetBrains Mono)                                       |
| `cyberpunk`       | Cyberpunk       | Neon magenta and cyan accents (Outfit + Fira Code)                                        |
| `darkmatter`      | Darkmatter      | Amber primary with mono-first UI (Geist Mono + JetBrains Mono)                            |
| `doom-64`         | Doom 64         | Hard-edged retro game palette (Oxanium + Source Code Pro)                                 |
| `elegant-luxury`  | Elegant Luxury  | Warm burgundy luxury palette (Poppins + Libre Baskerville + IBM Plex Mono)                |
| `graphite`        | Graphite        | Neutral graphite greyscale (Montserrat + Fira Code)                                       |
| `kodama-grove`    | Kodama Grove    | Earthy moss greens on warm parchment (Merriweather + Source Serif 4)                      |
| `midnight-bloom`  | Midnight Bloom  | Violet bloom accents (Montserrat + Playfair Display + Source Code Pro)                    |
| `mocha-mousse`    | Mocha Mousse    | Soft mocha browns (DM Sans + Georgia)                                                     |
| `modern-minimal`  | Modern Minimal  | Clean blue primary on crisp neutrals (Inter + Source Serif 4 + JetBrains Mono)            |
| `mono`            | Mono            | Strict monochrome UI with Geist Mono throughout                                           |
| `nature`          | Nature          | Forest green primary on warm earth tones (Montserrat + Merriweather)                      |
| `neo-brutalism`   | Neo Brutalism   | Hard edges, bold color blocks (DM Sans + Space Mono)                                      |
| `northern-lights` | Northern Lights | Aurora green with cool blues (Plus Jakarta Sans + JetBrains Mono)                         |
| `notebook`        | Notebook        | Handwritten notebook feel (Architects Daughter)                                           |
| `ocean-breeze`    | Ocean Breeze    | Fresh teal primary on airy blues (DM Sans + Lora + IBM Plex Mono)                         |
| `pastel-dreams`   | Pastel Dreams   | Soft lavender pastels with large radius (Open Sans + Source Serif 4)                      |
| `perpetuity`      | Perpetuity      | Teal terminal aesthetic (Source Code Pro)                                                 |
| `quantum-rose`    | Quantum Rose    | Vivid rose primary on soft pinks (Quicksand + Playfair Display)                           |
| `retro-arcade`    | Retro Arcade    | Playful arcade magenta and teal (Outfit + Space Mono)                                     |
| `sage-garden`     | Sage Garden     | Muted sage greens on warm paper (Antic + JetBrains Mono)                                  |
| `soft-pop`        | Soft Pop        | Playful violet and teal soft-pop accents (DM Sans + Space Mono)                           |
| `solar-dusk`      | Solar Dusk      | Warm dusk oranges on parchment (Oxanium + Merriweather + Fira Code)                       |
| `starry-night`    | Starry Night    | Painterly night blues with gold accents (Libre Baskerville)                               |
| `sunset-horizon`  | Sunset Horizon  | Warm sunset oranges (Montserrat + Merriweather + Ubuntu Mono)                             |
| `supabase`        | Supabase        | Supabase green brand palette (Outfit)                                                     |
| `t3-chat`         | T3 Chat         | Magenta-rose chat aesthetic with system fonts                                             |
| `tangerine`       | Tangerine       | Bright tangerine primary on cool slate (Inter + Source Serif 4)                           |
| `twitter`         | Twitter         | Sky-blue social palette (Open Sans)                                                       |
| `vercel`          | Vercel          | Stark black-and-white Vercel aesthetic (Geist + Geist Mono)                               |
| `vintage-paper`   | Vintage Paper   | Aged paper browns (Libre Baskerville + Lora + IBM Plex Mono)                              |
| `violet-bloom`    | Violet Bloom    | Bold violet bloom with tight tracking (Plus Jakarta Sans + Lora)                          |

```ts
import {
  defaultTheme,
  themes,
  themeNames,
  shelluiTheme,
  claudeTheme,
  lightGreenTheme,
  zenInspiredTheme,
  astroVistaTheme,
  shadcnTheme,
  amberMinimalTheme,
  amethystHazeTheme,
  boldTechTheme,
  bubblegumTheme,
  caffeineTheme,
  candylandTheme,
  catppuccinTheme,
  claymorphismTheme,
  cleanSlateTheme,
  cosmicNightTheme,
  cyberpunkTheme,
  darkmatterTheme,
  doom64Theme,
  elegantLuxuryTheme,
  graphiteTheme,
  kodamaGroveTheme,
  midnightBloomTheme,
  mochaMousseTheme,
  modernMinimalTheme,
  monoTheme,
  natureTheme,
  neoBrutalismTheme,
  northernLightsTheme,
  notebookTheme,
  oceanBreezeTheme,
  pastelDreamsTheme,
  perpetuityTheme,
  quantumRoseTheme,
  retroArcadeTheme,
  sageGardenTheme,
  softPopTheme,
  solarDuskTheme,
  starryNightTheme,
  sunsetHorizonTheme,
  supabaseTheme,
  t3ChatTheme,
  tangerineTheme,
  twitterTheme,
  vercelTheme,
  vintagePaperTheme,
  violetBloomTheme,
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
  "themes": [
    "shellui",
    "claude",
    "light-green",
    "zen-inspired",
    "astro-vista",
    "shadcn",
    "amber-minimal",
    "amethyst-haze",
    "bold-tech",
    "bubblegum",
    "caffeine",
    "candyland",
    "catppuccin",
    "claymorphism",
    "clean-slate",
    "cosmic-night",
    "cyberpunk",
    "darkmatter",
    "doom-64",
    "elegant-luxury",
    "graphite",
    "kodama-grove",
    "midnight-bloom",
    "mocha-mousse",
    "modern-minimal",
    "mono",
    "nature",
    "neo-brutalism",
    "northern-lights",
    "notebook",
    "ocean-breeze",
    "pastel-dreams",
    "perpetuity",
    "quantum-rose",
    "retro-arcade",
    "sage-garden",
    "soft-pop",
    "solar-dusk",
    "starry-night",
    "sunset-horizon",
    "supabase",
    "t3-chat",
    "tangerine",
    "twitter",
    "vercel",
    "vintage-paper",
    "violet-bloom"
  ],
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

Paste from shadcn or [tweakcn](https://tweakcn.com) CSS by mapping `:root` / `.dark` variables into `light` / `dark` (kebab-case keys work). Registry JSON from tweakcn (`cssVars.light` / `cssVars.dark`) maps the same way.

## How colors apply

The shell sets CSS variables as **full colors** on `:root`. Tailwind consumes them with `var(--background)` (not `hsl(var(--background))`). Hex and legacy HSL channel triples are still accepted and normalized.

## Theme selector UI

Settings → Appearance scales with the number of available themes (1 / few / many). The picker uses a responsive `auto-fill` grid so cards keep a readable size and more columns appear as the panel widens. Recommended themes sort first. Each preview uses the theme’s color swatches, typography, and `radius` so sharp vs soft corners are visible before you switch. Fonts from a theme’s `fonts.files` apply when that theme is active.

## Related

- [tweakcn](https://tweakcn.com) — design and customize shadcn themes
- [shadcn/ui themes](https://ui.shadcn.com/themes)
- [Layouts](/features/layouts)
- [Application settings](/features/application-settings)
- [CLI](/cli)
