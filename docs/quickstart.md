---
title: Create a project
sidebar_label: Create a Project
description: 'Run shellui init, start the development server, and build a production shell with an optional colocated iframe app.'
---

Create a Shellui project with the CLI, start the host, and build static files to `dist/web/`. You need Node.js 18+ and a working [CLI install](/installation).

## Scaffold with shellui init

From an empty directory (or a folder you want the CLI to fill):

```bash
mkdir my-shellui-app
cd my-shellui-app
shellui init
```

The wizard asks for a framework and a backend. Shortcuts skip the framework prompt:

```bash
shellui init react
shellui init empty
shellui init --framework next --backend none
```

`init` writes `shellui.config.json` (with `$schema` for editor autocomplete), placeholder files under `static/`, and - for JS frameworks - a companion app plus `dev.run` / `dev.url` so `shellui start` launches both. Overwrite an existing config with `shellui init --force`. Skip `npm`/`pnpm` install after a JS scaffold with `--no-install`.

Frameworks: `empty`, `react`, `vue`, `angular`, `next`, `nuxt`, `svelte`, `alpine`, `flutter`. Flutter is **Web only** and needs the Flutter SDK on PATH. See [CLI init](/cli#shellui-init).

If you still have a TypeScript config from an older project, convert it with `shellui config migrate`.

### Write the config by hand

Prefer `shellui init`. To start from JSON only:

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.config.schema.json",
  "port": 4000,
  "title": "My Shellui App",
  "backend": {
    "type": "supabase",
    "url": "http://localhost:54321"
  },
  "navigation": [
    {
      "label": "Home",
      "path": "home",
      "url": "http://localhost:4000/",
      "icon": "/icons/home.svg"
    }
  ]
}
```

`init` defaults the shell to port **4000**. If `port` is omitted, `shellui start` falls back to **3000**. String values may use `${VAR}` or `${VAR:-default}` - see [environment substitution](/cli#environment-variable-substitution). Store config outside the project root with `--config` or `SHELLUI_CONFIG`.

Put `favicon.svg`, `logo.svg`, and icons under `static/` (for example `static/icons/home.svg`). The CLI serves that folder.

## Start the development server

```bash
shellui start
```

Local install:

```bash
npx shellui start
```

`shellui dev` is the same command. The CLI starts Vite for `@shellui/core`, opens the browser on first start, watches config files, and prints the local URL. Listen on the LAN with `shellui start --host`. Open a native window with `shellui start --app` - see [Desktop app](/tauri).

Typical terminal output:

```text
Starting Shellui...
Loaded JSON config from /path/to/shellui.config.json
👀 Watching config file: /path/to/shellui.config.json

  VITE v7.x.x  ready in 123 ms

  ➜  Local:   http://localhost:4000/
  ➜  Network: use --host to expose
```

## Build for production

```bash
shellui build
```

The CLI resolves `${ENV}` placeholders at build time, embeds a frozen config in the bundle, writes `dist/web/shellui.config.json` (resolved values only), and emits a static site under `dist/web/`. That snapshot is public - do not put secrets in config. Changing env vars after the build has no effect until you rebuild.

## Shell plus an iframe app

The CLI builds the **shell** only. Your microfrontend is a normal app (Vite, Next.js, and so on). Both can share one `package.json`.

The [playground](https://github.com/shellui/playground) uses that pattern: Shellui CLI for the host, Vite for the iframe. One `pnpm start` runs both because config includes:

```json
{
  "dev": {
    "run": "vite",
    "url": "http://localhost:5173"
  }
}
```

```json
{
  "scripts": {
    "start": "shellui start",
    "start:app": "vite",
    "build": "shellui build && vite build"
  }
}
```

`start:app` is an escape hatch. `shellui start --shell-only` ignores `dev.run`. Flags `--run` and `--follow` override `dev`. See [companion process](/cli#companion-process).

`shellui start` and `shellui build` do not load your `vite.config.*`, PostCSS, `tsconfig.json`, or `VITE_*`. Tailwind for the shell scans `@shellui/core` only. The shell Vite cache is `node_modules/.vite-shellui`. See [tooling isolation](/cli#tooling-isolation).

Point navigation `url`s at the companion origin in development (for example `http://localhost:5173/#/`) and at the built path in production. Call [`@shellui/sdk`](/sdk) inside the iframe.

Typical tree:

```text
my-shellui-app/
├── shellui.config.json
├── package.json
├── static/
├── dist/
│   ├── web/
│   └── app/
└── node_modules/
```

`dist/` is generated and gitignored.

## Troubleshoot a failed start

**Port in use.** Set another port in config:

```json
{
  "port": 5000
}
```

**Config not loading.** Keep `shellui.config.json` in the project root (or pass `--config`). Validate JSON against `$schema`. JSON and split `shellui.*.config.json` files cannot coexist. TypeScript config is used only when no JSON or split files exist.

**Build errors.** Run `npm install` (or `pnpm install`), then re-read the CLI error. Invalid config fails at load time with schema messages.

## Next steps

- [Backend](/backend) - identity-service, Supabase, or a public shell
- [Authentication](/features/authentication) - login routes and guards
- [Navigation](/features/navigation) - iframe URLs and opening modes
- [CLI](/cli) - full command and config reference
- [Desktop app](/tauri) - native window with `--app`
