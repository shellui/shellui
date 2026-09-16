---
title: Scaffold a framework starter
sidebar_label: Framework Starters
description: Use shellui init to scaffold a companion app. Theme and i18n ship out of the box with the tiny SDK.
---

`shellui init` scaffolds a Shellui project and, for each JS framework, a companion iframe app already wired for theme and language. This page covers what init writes, the shared SDK pattern, and how each starter runs.

## What shellui init writes

Run the wizard or pass a framework id:

```bash
shellui init
shellui init react
shellui init --framework next --backend none
```

Init does the following:

1. Writes `shellui.config.json` (with `$schema`) - port **4000**, layout, theme `"shellui"`, Home nav, Settings modal
2. Adds placeholder files under `static/` (`favicon.svg`, `logo.svg`, icons)
3. For JS frameworks: copies a companion starter, sets `dev.run` / `dev.url`, and runs your package manager install unless `--no-install`
4. Points Home `url` at the companion origin so the shell loads the iframe app

Templates come from the GitHub tag that matches the CLI version (or a local monorepo copy). They are not bundled in the npm tarball. Overwrite an existing config with `--force`.

Supported positional ids: `empty`, `react`, `vue`, `angular`, `next`, `nuxt`, `svelte`, `alpine`. The wizard also offers **Other (coming soon)**, which writes a shell-only config with `static/` stubs and no framework template (same companion shape as empty). Command flags and backends are on [CLI init](/cli#shellui-init). First-run flow is on [Create a project](/quickstart).

## Theme and i18n out of the box

Every JS starter uses `@shellui/sdk/tiny` the same way you would wire it by hand:

1. Wait for `shellui.ready`
2. Call `shellui.applyTheme()` and subscribe with `shellui.on('theme', …)`
3. Read `shellui.language`, subscribe with `shellui.on('language', …)`, and drive a local i18n library (or a small message map)

```typescript
import { shellui } from '@shellui/sdk/tiny';

void shellui.ready.then(() => {
  shellui.applyTheme();
  applyLanguage(shellui.language);
});

shellui.on('theme', () => shellui.applyTheme());
shellui.on('language', applyLanguage);
```

Sample catalogs ship as `en` / `fr`. Change theme or language in Shell **Settings** and the companion home page updates. Framework-specific wiring (hooks, composables, services, plugins) is under each starter below. Related: [Themes](/features/themes), [Internationalization](/features/internationalization), [SDK](/sdk).

## Choose a framework

Pick a starter, then jump to its section for ports and stack notes:

<div class="framework-chooser" role="navigation" aria-label="Framework starters">
  <a class="framework-chip" href="#react">
    <img class="framework-chip__icon" src="/img/frameworks/react.svg" alt="" width="28" height="28" />
    <span class="framework-chip__label">React</span>
    <span class="framework-chip__meta">:5173</span>
  </a>
  <a class="framework-chip" href="#vue">
    <img class="framework-chip__icon" src="/img/frameworks/vue.svg" alt="" width="28" height="28" />
    <span class="framework-chip__label">Vue</span>
    <span class="framework-chip__meta">:5173</span>
  </a>
  <a class="framework-chip" href="#angular">
    <img class="framework-chip__icon" src="/img/frameworks/angular.svg" alt="" width="28" height="28" />
    <span class="framework-chip__label">Angular</span>
    <span class="framework-chip__meta">:4200</span>
  </a>
  <a class="framework-chip" href="#nextjs">
    <img class="framework-chip__icon" src="/img/frameworks/next.svg" alt="" width="28" height="28" data-framework="next" />
    <span class="framework-chip__label">Next.js</span>
    <span class="framework-chip__meta">:3000</span>
  </a>
  <a class="framework-chip" href="#nuxt">
    <img class="framework-chip__icon" src="/img/frameworks/nuxt.svg" alt="" width="28" height="28" />
    <span class="framework-chip__label">Nuxt</span>
    <span class="framework-chip__meta">:3000</span>
  </a>
  <a class="framework-chip" href="#sveltekit">
    <img class="framework-chip__icon" src="/img/frameworks/svelte.svg" alt="" width="28" height="28" />
    <span class="framework-chip__label">SvelteKit</span>
    <span class="framework-chip__meta">:5173</span>
  </a>
  <a class="framework-chip" href="#alpinejs">
    <img class="framework-chip__icon" src="/img/frameworks/alpine.svg" alt="" width="28" height="28" />
    <span class="framework-chip__label">Alpine.js</span>
    <span class="framework-chip__meta">:5173</span>
  </a>
  <a class="framework-chip" href="#empty-shell">
    <img class="framework-chip__icon" src="/img/frameworks/empty.svg" alt="" width="28" height="28" data-framework="empty" />
    <span class="framework-chip__label">Empty</span>
    <span class="framework-chip__meta">shell only</span>
  </a>
</div>

After init, from the project root:

```bash
shellui start
```

That starts the shell on **4000** and the companion on the port in the table below. Init sets `dev.run` to `{pm} run dev` for every JS starter. Run the companion alone with that script if you need it without the host.

| Framework                        | Init id                            | Companion `dev.url`     |
| -------------------------------- | ---------------------------------- | ----------------------- |
| React / Vue / SvelteKit / Alpine | `react`, `vue`, `svelte`, `alpine` | `http://localhost:5173` |
| Angular                          | `angular`                          | `http://localhost:4200` |
| Next.js / Nuxt                   | `next`, `nuxt`                     | `http://localhost:3000` |
| Empty                            | `empty`                            | none (Home at `/`)      |

<h3 class="framework-section-heading" id="react"><img class="framework-heading-icon" src="/img/frameworks/react.svg" alt="" width="28" height="28" />React</h3>

Vite + React starter; init id `react`, companion port **5173**.

```bash
shellui init react
shellui start
```

Theme and i18n in this starter:

- **Theme / i18n**: `src/useShellui.js` calls `shellui.applyTheme()` and syncs language into i18next (`src/i18n.js`, react-i18next)
- **Stack note**: the hook returns `{ theme, language, shellui }` for the home UI

<h3 class="framework-section-heading" id="vue"><img class="framework-heading-icon" src="/img/frameworks/vue.svg" alt="" width="28" height="28" />Vue</h3>

Vite + Vue starter; init id `vue`, companion port **5173**.

```bash
shellui init vue
shellui start
```

Theme and i18n in this starter:

- **Theme / i18n**: `src/composables/useShellui.js` updates vue-i18n `locale` from `shellui.on('language', …)`
- **Stack note**: `main.js` registers the i18n plugin; the composable owns the SDK listeners

<h3 class="framework-section-heading" id="angular"><img class="framework-heading-icon" src="/img/frameworks/angular.svg" alt="" width="28" height="28" />Angular</h3>

Angular starter; init id `angular`, companion port **4200**. Init sets `dev.run` to `{pm} run dev` (the package `dev` script runs `ng serve --port 4200`).

```bash
shellui init angular
shellui start
```

Theme and i18n in this starter:

- **Theme / i18n**: `ShelluiService` (`src/app/shellui.service.ts`) applies theme and resolves strings with `t()` over inline `en` / `fr` maps in `src/app/i18n.ts`
- **Stack note**: the root component starts the service on init; signals hold theme and language

<h3 class="framework-section-heading" id="nextjs"><img class="framework-heading-icon" src="/img/frameworks/next.svg" alt="" width="28" height="28" data-framework="next" />Next.js</h3>

Next.js App Router starter; init id `next`, companion port **3000** (pinned via `scripts/ensure-port.mjs`).

```bash
shellui init next
shellui start
```

Theme and i18n in this starter:

- **Theme / i18n**: client component `app/home.js` dynamic-imports `@shellui/sdk/tiny` (SSR-safe); `app/i18n.js` holds a plain `t(lang, key)` helper
- **Stack note**: keep SDK work in client components; do not import the tiny SDK at the top level of a Server Component

<h3 class="framework-section-heading" id="nuxt"><img class="framework-heading-icon" src="/img/frameworks/nuxt.svg" alt="" width="28" height="28" />Nuxt</h3>

Nuxt starter; init id `nuxt`, companion port **3000** (`nuxt.config.ts` `devServer.port`).

```bash
shellui init nuxt
shellui start
```

Theme and i18n in this starter:

- **Theme / i18n**: client plugin `app/plugins/shellui.client.ts` writes shared state; `app/composables/useShellui.ts` reads `useState('shellui-theme' | 'shellui-language')`
- **Stack note**: Nuxt 4 expects a recent Node 22.x / 24.x

<h3 class="framework-section-heading" id="sveltekit"><img class="framework-heading-icon" src="/img/frameworks/svelte.svg" alt="" width="28" height="28" />SvelteKit</h3>

SvelteKit starter; init id `svelte`, companion port **5173**.

```bash
shellui init svelte
shellui start
```

Theme and i18n in this starter:

- **Theme / i18n**: `src/lib/shellui.js` starts listeners from `+layout.svelte` `onMount`; `src/lib/i18n.js` uses writable / derived stores
- **Stack note**: dynamic import keeps the SDK off the server render path

<h3 class="framework-section-heading" id="alpinejs"><img class="framework-heading-icon" src="/img/frameworks/alpine.svg" alt="" width="28" height="28" />Alpine.js</h3>

Vite + Alpine.js starter; init id `alpine`, companion port **5173**.

```bash
shellui init alpine
shellui start
```

Theme and i18n in this starter:

- **Theme / i18n**: `src/main.js` registers `Alpine.data('shelluiHome', …)` with ready / theme / language handlers; `src/i18n.js` exports `t()`
- **Stack note**: init also sets `language: ["en", "fr"]` in config so Settings lists both locales. No Tailwind in this starter

<h3 class="framework-section-heading" id="empty-shell"><img class="framework-heading-icon" src="/img/frameworks/empty.svg" alt="" width="28" height="28" data-framework="empty" />Empty shell</h3>

Shell-only project; init id `empty`. No companion, no `dev` block. Home stays at `/`.

```bash
shellui init empty
shellui start
```

Add your own iframe app later and set `dev.run` / `dev.url` - see [companion process](/cli#companion-process).

## Companion checklist

After `shellui start`:

1. Open `http://localhost:4000/` - the shell loads the companion in Home
2. Open Shell **Settings** and switch theme - the iframe page should restyle
3. Switch language to French - sample strings should update

If the companion port is busy, free it or change both the framework config and `dev.url` together. Picked **Other** in the wizard? You get a shell-only config like empty; wire your own companion the same way. Details: [Create a project](/quickstart), [CLI](/cli).
