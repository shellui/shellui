---
title: CLI reference
sidebar_label: CLI
description: 'shellui commands, config files, environment substitution, tooling isolation, and preview deploy.'
---

The `@shellui/cli` binary is `shellui`. Install it from the [installation page](/installation). This page is the command and config reference. For a first project, use [Create a project](/quickstart).

## Commands

### shellui init

Create a project with the wizard or with flags.

```bash
shellui init
shellui init react
shellui init vue
shellui init angular
shellui init next
shellui init nuxt
shellui init svelte
shellui init alpine
shellui init empty
```

Non-interactive:

```bash
shellui init --framework react --backend shellui --company-id 123
shellui init --framework vue --backend supabase --supabase-url https://your_project.supabase.co
shellui init --framework empty --backend none
shellui init react ./my-project
shellui init --force
```

Without flags, the wizard asks for framework and backend. JS starters are fetched from the GitHub tag that matches the CLI version (not bundled in the npm tarball). They wire `@shellui/sdk/tiny` for theme and language, plus `dev.run` / `dev.url` so `shellui start` launches the companion. Empty stays shell-only (`Home` at `/`, no `dev` block). After a JS scaffold, init detects the package manager and runs install unless `--no-install`.

| Framework                        | Default `dev.run` | `dev.url`               |
| -------------------------------- | ----------------- | ----------------------- |
| React / Vue / SvelteKit / Alpine | `{pm} run dev`    | `http://localhost:5173` |
| Angular                          | `{pm} run dev`    | `http://localhost:4200` |
| Next.js / Nuxt                   | `{pm} run dev`    | `http://localhost:3000` |

The shell stays on port **4000** in generated config. Next.js and Nuxt companions pin port 3000. Nuxt 4 expects a recent Node 22.x / 24.x. Per-framework theme / i18n wiring, icons, and run notes: [Framework starters](/framework-starters).

**Options:** positional `framework` or `--framework`; `--backend none|shellui|supabase`; `--company-id`; `--supabase-url`; `--force`; `--no-install`; `--config`.

### shellui config migrate [root]

Evaluate `shellui.config.ts` the same way `start` / `build` do, write `shellui.config.json` with `$schema`, and rename the TypeScript file to `shellui.config.ts.bak`. Runtime values (`process.env`, `readFileSync`, computed fields) become plain JSON. The result is schema-validated. Review env-dependent values, then optionally `shellui config split`.

### shellui config split / unsplit [root]

Split one `shellui.config.json` into section files such as `shellui.root.config.json`, `shellui.navigation.config.json`, `shellui.backend.config.json`, `shellui.dev.config.json`, and other present top-level keys. After a successful split, `shellui.config.json` is removed - single-file and split modes cannot coexist.

`unsplit` merges `shellui.*.config.json` back, validates, and deletes the split files. Duplicate top-level keys across files are rejected.

### shellui start [root] / shellui dev [root]

Start the development server. `dev` is an alias for `start`.

```bash
shellui start
shellui start ./my-project
shellui start --host
shellui start --app
shellui start --run vite --follow http://localhost:5173
shellui start --shell-only
```

Starts Vite with HMR for `@shellui/core`, opens the browser on first start, watches config, and uses `port` from config (default **3000** if unset). Does not load the project's Vite / PostCSS / TypeScript / Tailwind files - see [Tooling isolation](#tooling-isolation). `--app` starts the [desktop wrapper](/tauri).

**Options:** `[root]`; `--host` (`0.0.0.0`); `--app`; `--target web|tauri` (default `web`; `tauri` with `--app`); `--config` / `SHELLUI_CONFIG`; `--run`; `--follow`; `--shell-only`. Do not pass `--no-run` - cac treats that as a negation of `--run <command>` and breaks plain `shellui start`.

### Companion process

CLI-only. Never sent to the browser. `shellui build` ignores it.

```json
{
  "dev": {
    "run": "vite",
    "url": "http://localhost:5173",
    "name": "app"
  }
}
```

- **Spawn** (`run` set): `shellui start` is the parent. If `url` is set, the CLI waits for it before listening. Child **exit** (not a brief port blip) shuts down the shell.
- **Follow** (`url` only): start the shell as usual. After the URL has been healthy once, if it stays down (~2s), the CLI exits. A URL that never comes up does not kill the shell.
- Config-file restarts restart shell Vite only; the companion keeps running.
- `--app` does not spawn a companion itself. The nested `shellui start` from Tauri will, if `dev.run` is set.

### shellui build [root]

Build a production static site to `dist/web/`. Same isolated toolchain as `start`. `--app` also builds native bundles under `dist/app/`. `--bundles` selects desktop formats (default `app`; `app,dmg` on macOS). See [Desktop app - bundle targets](/tauri#bundle-targets).

### shellui login [root]

Sign in against identity-service and store CLI credentials (mode `0600`) for later commands such as `deploy`.

```bash
shellui login
shellui login --config ./config
shellui login --provider github
```

Walks from `[root]` (or cwd) up to `.git` looking for config. Opens `{backend.url}/api/v1/authorize?company_id=…&redirect_to=http://127.0.0.1:<port>/callback`. Loopback is always allowlisted.

Required config: `backend.type: "shellui"`, `backend.companyId`, `backend.url` (default `https://id.shellui.com`). A running shell / `backend.loginUrl` is not required. Register `{backend.url}/api/v1/oauth/callback` on the OAuth provider app.

Credentials: `~/.config/shellui/credentials.json` (or `$XDG_CONFIG_HOME/shellui/credentials.json`); Windows `%APPDATA%\shellui\credentials.json`. Tokens are never printed.

### shellui logout / whoami

`shellui logout` removes stored credentials and best-effort `POST /api/v1/logout` when a token is present. `shellui whoami` calls `GET /api/v1/user` and refreshes the access token when expired.

### shellui deploy [root]

Upload `dist/web/` to [hosting-service](https://github.com/shellui/hosting-service) as a **preview** site (7-day TTL unless you redeploy the same slug). Requires `shellui login` and `hosting.url`.

```bash
shellui deploy
shellui deploy --build
shellui deploy --version 1.2.0 --slug my-preview
shellui deploy --dry-run
shellui deploy history
shellui deploy rollback --to 1.1.0
shellui deploy rollback --deployment your_deployment_uuid_here
```

Builds a `tar.gz` of `dist/web/` and uploads (create app if needed → create deployment → upload → finalize). App version comes from `--version`, `config.version`, or `package.json`. `shellui_version` comes from installed `@shellui/core`. Runs `shellui build` when `dist/web/` is missing or when `--build` is passed.

**Required:** `hosting.url` (for example `http://localhost:8002`). Optional `hosting.slug` to redeploy the same preview. `--slug` overrides config. `--app` is a deprecated alias for `--slug`. `hosting.app` in config is ignored for preview deploys (CLI prints a warning). Optional `hosting.publicUrl` when browsable URLs differ from the API base. `hosting.showInAdmin: false` hides Admin → Hosting without affecting deploy.

## Configuration

Load order inside the config directory:

1. `shellui.config.json`
2. Split `shellui.<name>.config.json` (only when no main JSON file is present)
3. `shellui.config.ts`

You cannot mix a main JSON file with split files. Config is validated against `@shellui/core` `schemas/shellui.config.schema.json`. Invalid config fails at load time.

### Custom config location

Default is project `[root]` (cwd). `--config` or `SHELLUI_CONFIG` points at another directory or a specific file. `--config` wins when both are set. Project root still holds `static/` and `dist/`.

```bash
shellui start --config ./config
shellui start --config ./config/shellui.config.json
export SHELLUI_CONFIG=./config
```

Point editors at the schema:

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.config.schema.json",
  "port": 4000,
  "title": "My Application"
}
```

### Environment variable substitution

Any **string** in loaded config (JSON, split, or TypeScript export) may contain placeholders, resolved when the CLI loads config - after read, before schema validation, recursively:

| Syntax            | Behavior                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `${VAR}`          | `process.env.VAR`. Unset or empty becomes `""` and the CLI warns |
| `${VAR:-default}` | `default` when `VAR` is unset or empty                           |

When a value is **exactly** one placeholder, the result is coerced if it looks like a JSON literal: `"${PORT:-4000}"` → number `4000`, `"${FLAG:-true}"` → boolean, `"${X:-null}"` → `null`. Embedded placeholders stay strings.

Substitution runs **only in the CLI**. The browser never reads `.env` to fill `${VAR}`. On `shellui build`, resolved values are embedded via `@shellui/config` and written to `dist/web/shellui.config.json`. There is no runtime override.

Treat config as public. URLs, feature flags, and publishable keys in `shellui.config.json` ship to the client. Keep secrets on a real backend.

```json
{
  "backend": {
    "type": "shellui",
    "url": "${SHELLUI_BACKEND_URL:-https://id.shellui.com}",
    "adminUrl": "${SHELLUI_ADMIN_URL:-https://admin.shellui.com}",
    "companyId": "${SHELLUI_COMPANY_ID:-1}"
  },
  "storage": {
    "url": "${SHELLUI_STORAGE_URL:-http://localhost:8001}"
  }
}
```

The CLI loads dotenv from the project `.env`. Sentry also merges from `SENTRY_DSN`, `SENTRY_ENABLED`, and related vars after load - see [Sentry](/sentry). A DSN in the frontend bundle is expected for client-side Sentry; it is still not a secret with write access to your infra.

### Selected fields

- **`port`** (number, optional): dev server port. Default `3000` if omitted (`init` writes `4000`).
- **`title`** (string, optional): chrome title.
- **`backend`**: see [Backend](/backend).
- **`storage`**: `url` (required when set), optional `filesUrl`, `showInSettings`. See [Storage](/features/storage).
- **`hosting`**: `url`, optional `slug`, `publicUrl`, `showInAdmin`.
- **`navigation`**: see [Navigation](/features/navigation).
- **`dev`**: companion `run` / `url` / `name` - stripped before the config reaches the browser.

TypeScript config is an advanced fallback. Prefer JSON. Example when you need `readFileSync` for legal markdown:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'My Shellui App',
  backend: {
    type: 'supabase',
    url: 'http://localhost:54321',
  },
  navigation: [
    {
      label: 'Documentation',
      path: 'docs',
      url: 'https://docs.example.com/',
      icon: '/icons/book-open.svg',
    },
  ],
};

export default config;
```

`shellui start` watches the active config files and restarts the shell Vite process on change.

## Project layout

```text
my-project/
├── shellui.config.json
├── package.json
├── static/
├── dist/
│   ├── web/
│   └── app/
└── node_modules/
```

The CLI does not replace your app toolchain. Set `dev.run` so one `shellui start` also runs the iframe app. The [playground](https://github.com/shellui/playground) uses one pnpm project for both.

## Tooling isolation

`shellui start` and `shellui build` use an inline Vite config (`configFile: false`). They never merge the consumer project's toolchain.

| Consumer file                           | What the shell uses                                                      |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `vite.config.*`                         | Inline config, root = `@shellui/core`                                    |
| `postcss.config.*`, `tailwind.config.*` | CLI PostCSS + Tailwind v4, scan limited to `@shellui/core/src`           |
| `tsconfig.json` / `jsconfig.json`       | Inline `esbuild.tsconfigRaw` (React JSX)                                 |
| `.env`, `.env.*`, `VITE_*`              | Vite `envDir: false`; `import.meta.env` prefix is `SHELLUI_PUBLIC_` only |
| `node_modules/.vite`                    | `node_modules/.vite-shellui`                                             |

`${VAR}` in config still reads process env (including project `.env` via dotenv) at CLI load time. Those values are for config substitution, not Vite `import.meta.env`. The dev server does not serve project `src/` - only `@shellui/core`, `node_modules`, `static/`, and optional `themesDir`.

## Troubleshooting

**`command not found: shellui`.** Install globally or use `npx shellui start`.

**Configuration not found.** Add `shellui.config.json` or run `shellui init`. Pass `--config` if files live elsewhere.

**Port already in use.** Change `port` in config.

**TypeScript config not loading.** Used only when no JSON or split config is present. Export a serializable `export default` or `export const config`. Install `typescript` as a dev dependency if evaluation fails.
