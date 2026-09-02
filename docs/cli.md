# Shellui CLI

The Shellui CLI is the command-line tool for developing and building Shellui applications.

## Installation

See the [Installation Guide](/installation) for detailed installation instructions.

## Commands

### `shellui init [root]`

Create a `shellui.config.json` boilerplate to get started quickly.

**Usage:**

```bash
shellui init
shellui init ./my-project
shellui init --force
```

**Description:**

- Creates a minimal `shellui.config.json` in the project root (or the given directory)
- Includes `$schema` for editor autocomplete, port, title, layout, language, and sample navigation (Home + Settings)
- Does not overwrite an existing config unless `--force` is used

**Options:**

- `root` (optional): Directory where to create the config (default: current directory)
- `--force`: Overwrite existing `shellui.config.json`

**Example:**

```bash
# Create config in current directory
shellui init

# Create config in a subdirectory
shellui init ./my-app

# Overwrite existing config
shellui init --force
```

After running `shellui init`, add a `static/` folder with `favicon.svg`, `logo.svg`, and `icons/` (e.g. `home.svg`, `settings.svg`) to customize assets, then run `shellui dev` to begin development.

### `shellui config migrate [root]`

Migrate an existing `shellui.config.ts` to `shellui.config.json`.

**Usage:**

```bash
shellui config migrate
shellui config migrate ./my-project
```

**Description:**

- **Evaluates** the TypeScript config (same as `shellui start` / `build`) and writes the resulting initialized object as JSON
- Runtime values are baked in: `process.env`, `readFileSync` contents, computed fields, etc. become plain JSON values
- Writes `shellui.config.json` with `$schema`
- Renames `shellui.config.ts` to `shellui.config.ts.bak` (does not delete)
- Validates the result against the JSON Schema

If no `shellui.config.ts` is found, the command exits with a helpful error. Review the JSON afterward (especially env-dependent values), then optionally run `shellui config split`.

### `shellui config split [root]` / `shellui config unsplit [root]`

Split a single `shellui.config.json` into focused files, or merge them back.

**Usage:**

```bash
shellui config split
shellui config unsplit
shellui config split ./my-project
```

**Split** turns one file into section files such as:

- `shellui.root.config.json` — scalars (`port`, `title`, `layout`, …)
- `shellui.navigation.config.json`
- `shellui.storage.config.json`
- `shellui.hosting.config.json`
- `shellui.backend.config.json` (authentication / API)
- `shellui.administration.config.json`
- `shellui.dev.config.json` (CLI companion for `shellui start`)
- …and other top-level sections that are present

After a successful split, `shellui.config.json` is removed (single-file and split modes cannot coexist).

**Unsplit** merges all `shellui.*.config.json` files back into `shellui.config.json`, validates the result, and deletes the split files. Duplicate top-level keys across split files are rejected.

### `shellui start [root]` / `shellui dev [root]`

Start the Shellui development server. `dev` is an alias for `start`.

**Usage:**

```bash
shellui start
shellui dev
shellui start ./my-project
shellui dev --host
shellui dev --app
shellui start --run vite --follow http://localhost:5173
```

**Description:**

- Starts a Vite development server with hot module replacement
- Automatically opens your browser (on first start)
- Watches for configuration file changes and restarts automatically
- Uses the port specified in your configuration (default: 3000)
- Does not load the project’s Vite / PostCSS / TypeScript / Tailwind config (see [Tooling isolation](#tooling-isolation))
- With `--app`, starts a native desktop development environment (see [Desktop app](/tauri))
- Optional **companion**: spawn a colocated app (`dev.run` or `--run`) and exit when that process dies; or follow a URL (`dev.url` / `--follow` without `run`) and exit after it has been up then stays down

**Options:**

- `root` (optional): Project root directory (default: current directory)
- `--host`: Listen on `0.0.0.0` so the app can be accessed from other devices on your network (e.g. via your machine’s LAN IP)
- `--app`: Start as a native desktop app. On first run, generates `dist/app/` (desktop wrapper) and installs desktop build tools if needed.
- `--target <web|tauri>`: Build target injected at compile time (default: `web`). Set to `tauri` for desktop-specific behavior (e.g. disable service worker). Automatically applied when using `--app`.
- `--config <path>`: Config file or directory (default: project root). See [Custom config location](#custom-config-location). Also: `SHELLUI_CONFIG`.
- `--run <command>`: Spawn a companion in the project root (overrides `dev.run`). Logs are prefixed with `[app]` (or `dev.name`).
- `--follow <url>`: Wait for this URL before opening the shell (spawn mode), or follow it and exit if it goes down after it was healthy (follow-only). Overrides `dev.url`.
- `--shell-only`: Ignore `dev.run` and do not spawn a companion (shell only). Do not use `--no-run` — cac treats that as a negation of `--run <command>` and breaks plain `shellui start`.

**Example:**

```bash
# Start server in current directory
shellui dev

# Start server in specific directory
shellui start ./my-app

# Allow access from network (e.g. from phone or another machine)
shellui dev --host

# Start desktop development (Shellui server + native window)
shellui dev --app

# Spawn a colocated Vite app, then the shell; Ctrl+C or a Vite crash stops both
shellui start --run vite --follow http://localhost:5173
```

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

- **Spawn** (`run` set): `shellui start` is the parent. If `url` is set, the CLI waits for it before listening. Child process **exit** (not a brief port blip) shuts down the shell.
- **Follow** (`url` only): start the shell as usual. After the URL has been healthy once, if it stays down (~2s), the CLI exits. A URL that never comes up does not kill the shell.
- Config-file restarts restart the shell Vite only; the companion keeps running.
- `--app` does not spawn a companion itself — the nested `shellui start` from Tauri will, if `dev.run` is set.

### `shellui build [root]`

Build the Shellui application for production.

**Usage:**

```bash
shellui build
shellui build ./my-project
shellui build --app
shellui build --app --bundles app,dmg
```

**Description:**

- Builds your Shellui application for production
- Outputs optimized files to `dist/web/`
- Minifies and optimizes assets
- Creates a production-ready static site
- Uses the same isolated toolchain as `shellui start` (see [Tooling isolation](#tooling-isolation))
- With `--app`, builds a native desktop app (web assets to `dist/web/`, desktop wrapper and bundles under `dist/app/`)

**Options:**

- `root` (optional): Project root directory (default: current directory)
- `--app`: Build the desktop app. Generates `dist/app/` on first run and installs desktop build tools if needed.
- `--bundles <targets>`: Desktop bundle format(s) when using `--app` (comma-separated). Default: `app` (e.g. `.app` on macOS). Use `app,dmg` on macOS to also produce a `.dmg` installer. See [Desktop app — Bundle targets](/tauri#bundle-targets).
- `--target <web|tauri>`: Build target injected at compile time (default: `web`). Set to `tauri` for desktop builds. Automatically applied when using `--app`.
- `--config <path>`: Config file or directory (default: project root). See [Custom config location](#custom-config-location). Also: `SHELLUI_CONFIG`.

**Example:**

```bash
# Build in current directory
shellui build

# Build specific project
shellui build ./my-app

# Build native desktop app (.app on macOS, default)
shellui build --app

# Build desktop app + macOS DMG installer (for distribution)
npx shellui build --app --bundles app,dmg
```

### `shellui login [root]`

Sign in via browser OAuth against the identity service and store CLI credentials for later commands (for example publish).

**Usage:**

```bash
shellui login
shellui login ./my-project
shellui login --config ./config
shellui login --provider github
```

**Description:**

- Finds `shellui.config.json` (or split config) by walking from the current directory (or `[root]`) up through parent folders, stopping at the nearest `.git`
- Opens `{backend.url}/api/v1/authorize?company_id=…&redirect_to=http://127.0.0.1:<port>/callback` (loopback is always allowlisted)
- Identity shows a sign-in method picker (even when only one provider is enabled), then account confirmation, then completes the provider callback and bounces tokens to the CLI loopback listener in the URL fragment
- Stores access + refresh tokens in a user credentials file (mode `0600`)

**Required config**

- `backend.type`: `"shellui"`
- `backend.companyId`
- `backend.url` — identity API (default `https://id.shellui.com`)

A running shell / `backend.loginUrl` is **not** required. Register the identity callback (`{backend.url}/api/v1/oauth/callback`) on the OAuth provider app.

**Options:**

- `root` (optional): Directory to start the config walk (default: current directory)
- `--config <path>`: Explicit config file or directory (skips the walk). Also: `SHELLUI_CONFIG`
- `--provider <name>`: Skip the method picker and go straight to that OAuth provider (e.g. `github`, `google`, `microsoft`)

**Credentials file:**

- macOS / Linux: `~/.config/shellui/credentials.json` (or `$XDG_CONFIG_HOME/shellui/credentials.json`)
- Windows: `%APPDATA%\shellui\credentials.json`

Tokens are never printed. No extra OAuth app callback is required beyond the normal shell `/login/callback`.

### `shellui logout`

Remove stored CLI credentials (and best-effort `POST /api/v1/logout` when a token is present).

```bash
shellui logout
```

### `shellui whoami`

Show the signed-in profile (`GET /api/v1/user`) using stored credentials. Refreshes the access token when expired.

```bash
shellui whoami
```

### `shellui deploy [root]`

Upload `dist/web/` to [hosting-service](https://github.com/shellui/hosting-service). Requires `shellui login` and `hosting.url` in config.

**Usage:**

```bash
shellui deploy
shellui deploy --build
shellui deploy --version 1.2.0 --app my-app
shellui deploy --dry-run
shellui deploy history
shellui deploy rollback --to 1.1.0
shellui deploy rollback --deployment <uuid>
```

**Description:**

- Uses `hosting.url` and `hosting.app` from config (or `--app`)
- Builds a `tar.gz` of `dist/web/` and uploads via the hosting API (create app if needed → create deployment → upload → finalize)
- `app_version` from `--version`, `config.version`, or `package.json`
- `shellui_version` from `@shellui/core` in `package.json`
- Runs `shellui build` when `dist/web/` is missing or when `--build` is passed

**Required config**

- `hosting.url` — hosting-service base URL (e.g. `http://localhost:8002`)
- `hosting.app` — default app slug (or pass `--app`)

**Options:**

- `--build` — Run `shellui build` before deploying
- `--version <version>` — App version string
- `--app <slug>` — App slug or UUID (overrides `hosting.app`)
- `--dry-run` — Print the deployment plan without calling the API
- `--config <path>` — Config file or directory

### `shellui deploy history [root]`

List deployments for the configured app.

### `shellui deploy rollback [root]`

Activate a previous deployment. Pass `--to <app_version>` or `--deployment <uuid>`.

## Configuration

Shellui uses a JSON configuration file by default. The CLI looks for config in this order:

1. `shellui.config.json` (single file)
2. Split files: `shellui.<name>.config.json` (when no main JSON file is present)
3. `shellui.config.ts` (advanced, code-based configuration)

You cannot use a main JSON file and split files at the same time. Configuration is validated against the JSON Schema shipped with `@shellui/core` (`schemas/shellui.config.schema.json`). Invalid config fails at load time with actionable errors.

### Custom config location

By default the CLI looks for config in the project root (`[root]` argument, or the current directory). Use `--config` (or the `SHELLUI_CONFIG` environment variable) to store config in another folder or point at a specific file:

```bash
# Directory containing shellui.config.json / split files / shellui.config.ts
shellui start --config ./config
shellui build --config ./config
shellui init --config ./config
shellui config migrate --config ./config

# Or a specific file
shellui start --config ./config/shellui.config.json
shellui init --config ./config/shellui.config.json

# Same via env (handy in CI)
export SHELLUI_CONFIG=./config
shellui start
```

- **Project root** (`[root]`) still holds `static/`, `dist/`, etc.
- **Config directory** is where `shellui.config.json`, `shellui.*.config.json`, or `shellui.config.ts` live.
- `--config` wins over `SHELLUI_CONFIG` when both are set.

Point editors at the schema via `$schema`:

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.config.schema.json",
  "port": 4000,
  "title": "My Application"
}
```

### Environment variable substitution

Any **string** value in the loaded configuration (JSON, split files, or TypeScript export) may contain placeholders that are resolved when the CLI loads the config:

| Syntax            | Behavior                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `${VAR}`          | Replaced with `process.env.VAR`. If unset or empty, becomes `""` and the CLI prints a warning. |
| `${VAR:-default}` | Uses `default` when `VAR` is unset or empty; otherwise uses the env value.                     |

Placeholders are resolved **recursively** in nested objects and arrays, after the config file(s) are read and **before** schema validation.

When a value is **exactly** one placeholder (no surrounding text), the result is coerced when it looks like a JSON literal:

- `"${PORT:-4000}"` → number `4000`
- `"${FLAG:-true}"` → boolean `true`
- `"${X:-null}"` → `null`

Embedded placeholders stay strings: `"https://${HOST}/api"` → `"https://localhost/api"`.

#### Build-time freeze (important)

Env substitution runs **only in the CLI** (`shellui start`, `shellui build`, …). The browser never reads your `.env` or host environment to fill `${VAR}`.

On `shellui build`:

1. The CLI resolves all placeholders using the build-time environment.
2. That **frozen** object is embedded in the JS bundle via `@shellui/config`.
3. The same snapshot is written to `dist/web/shellui.config.json` for inspection/deploy artifacts.

There is **no** runtime override of env placeholders in the frontend. Changing env vars after the build has no effect until you rebuild.

**Treat config as public.** Anything in `shellui.config.json` (and thus in the generated frontend snapshot) is visible to users — URLs, feature flags, publishable keys, etc. Do **not** put secrets, private API keys, or credentials in Shellui config. Use a real backend for secrets.

**Example (dev vs production URLs):**

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.config.schema.json",
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

```bash
# Local overrides via env (or .env — the CLI loads dotenv)
export SHELLUI_BACKEND_URL=http://localhost:8000
export SHELLUI_ADMIN_URL=http://localhost:5174
shellui start

# Production build bakes current env values into the frontend bundle
SHELLUI_BACKEND_URL=https://id.shellui.com shellui build
# → dist/web/shellui.config.json contains resolved values only
```

Sentry remains configurable via dedicated env vars (`SENTRY_DSN`, `SENTRY_ENABLED`, …) merged after load; you can also put `sentry.dsn` in JSON with `${SENTRY_DSN}` if you prefer. Remember a DSN in the frontend bundle is expected for client-side Sentry — still not a secret with write access to your infra.

### Configuration File Location

The CLI searches for configuration files in this order:

1. Path from `--config` / `SHELLUI_CONFIG` (file or directory), if set
2. Otherwise the project `root` directory (CLI `[root]` argument, default: current working directory)

Inside that location it prefers, in order: `shellui.config.json` → split `shellui.<name>.config.json` files → `shellui.config.ts`.

### Configuration Options

#### `port` (number, optional)

Port number for the development server.

```json
{
  "port": 4000
}
```

**Default:** `3000`

#### `title` (string, optional)

Application title displayed in the UI.

```json
{
  "title": "My Application"
}
```

#### `backend` (object, optional)

Backend communication settings used for auth/API integration. See [Backend](/backend) and [Authentication](/features/authentication).

```json
{
  "backend": {
    "type": "supabase",
    "url": "http://localhost:54321"
  }
}
```

**Default:** `undefined`

**Properties:**

- `type` (`"shellui" | "supabase"`, required when `backend` is set): Backend provider.
- `url` (`string`, required when `backend` is set): Base API URL.

#### `storage` (object, optional)

Storage-service connection. See [Storage](/features/storage).

```json
{
  "storage": {
    "url": "http://localhost:8001",
    "filesUrl": "http://localhost:5175/",
    "showInSettings": true
  }
}
```

**Default:** `undefined` (Settings → Storage is hidden)

**Properties:**

- `url` (`string`, required when `storage` is set): Base URL of storage-service.
- `filesUrl` (`string`, optional): Files explorer app URL for Admin → Storage.
- `showInSettings` (`boolean`, optional): When `false`, hide Settings → Storage. Default: `true` when `url` is set.

#### `hosting` (object, optional)

Hosting-service connection for `shellui deploy`. Propagated to iframe apps via SDK `settings.hosting`.

```json
{
  "hosting": {
    "url": "http://localhost:8002",
    "app": "my-app"
  }
}
```

**Default:** `undefined`

**Properties:**

- `url` (`string`, required when `hosting` is set): Base URL of hosting-service.
- `app` (`string`, optional): Default app slug or UUID for `shellui deploy`.

#### `navigation` (array, optional)

Array of navigation items for the sidebar. See the [Navigation Guide](/features/navigation) for complete documentation.

```json
{
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

**Basic Navigation Item Properties:**

- `label` (string | LocalizedString, required): Display text for the navigation item
- `path` (string, required): Unique path identifier
- `url` (string, required): URL to navigate to when clicked
- `icon` (string, optional): Path to SVG icon file (e.g., "/icons/home.svg")

For advanced navigation features like groups, localization, visibility control, and opening modes, see the [Navigation Guide](/features/navigation).

### Example Configuration

**JSON (`shellui.config.json`) — recommended:**

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
      "label": "Documentation",
      "path": "docs",
      "url": "https://docs.example.com/",
      "icon": "/icons/book-open.svg"
    },
    {
      "label": "Dashboard",
      "path": "dashboard",
      "url": "http://localhost:4000/",
      "icon": "/icons/layout.svg"
    },
    {
      "label": "Settings",
      "path": "settings",
      "url": "/__settings",
      "icon": "/icons/settings.svg",
      "openIn": "modal",
      "position": "end"
    }
  ]
}
```

**Advanced TypeScript (`shellui.config.ts`):**

Use TypeScript only when you need code (for example loading markdown from disk). Prefer JSON for declarative config. Migrate with `shellui config migrate` when possible.

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

### Configuration File Watching

When you run `shellui start`, the CLI automatically watches your active configuration file(s) for changes. When you modify the configuration:

1. The server detects the change
2. Automatically restarts with the new configuration
3. The browser will refresh with updated settings

This allows you to iterate on your configuration without manually restarting the server.

## Project Structure

When using the CLI, your project structure should look like:

```
my-project/
├── shellui.config.json
├── package.json
├── static/                # Optional static assets (favicon, icons, fonts)
├── dist/                  # Build output (gitignored, generated locally)
│   ├── web/               # Web build (`shellui build`)
│   └── app/               # Desktop wrapper (`shellui dev --app` / `shellui build --app`)
└── node_modules/
```

Only source files are committed — `dist/` is generated on each machine (`shellui init` adds `dist/` to `.gitignore`).

The CLI does not replace your app toolchain. Put iframe apps in the same package if you want, or keep them in another repo. Set `dev.run` so one `shellui start` (e.g. `"start": "shellui start"`) also runs the app and exits when that process dies. See [Quick Start — Shell plus an embedded app](/quickstart#shell-plus-an-embedded-app). The [playground](https://github.com/shellui/playground) uses one pnpm project for both.

## Tooling isolation

`shellui start` and `shellui build` run an **inline** Vite config. They never search for or merge the consumer project’s toolchain. Colocating the shell and an iframe app in one folder is the supported pattern — you should only maintain your app plus `shellui.config.json` and `static/`.

The CLI ignores:

| Consumer file                           | What the shell uses instead                                              |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `vite.config.*`                         | Inline config (`configFile: false`), root = `@shellui/core`              |
| `postcss.config.*`, `tailwind.config.*` | CLI PostCSS + Tailwind v4, scan limited to `@shellui/core/src`           |
| `tsconfig.json` / `jsconfig.json`       | Inline `esbuild.tsconfigRaw` (React JSX)                                 |
| `.env`, `.env.*`, `VITE_*`              | Vite `envDir: false`; `import.meta.env` prefix is `SHELLUI_PUBLIC_` only |
| `node_modules/.vite`                    | `node_modules/.vite-shellui`                                             |

`${VAR}` in `shellui.config.json` still reads process env (including a project `.env` via `dotenv`) at CLI load time. Those values are for config substitution, not for Vite `import.meta.env`.

The dev server does not serve the project `src/` tree — only `@shellui/core`, `node_modules`, `static/`, and optional `themesDir`.

## Configuration Reference

For detailed configuration options, see:

- **[Navigation](/features/navigation)** - Navigation menus, groups, icons, and display modes
- **[Layouts](/features/layouts)** - Sidebar, fullscreen, windows (experimental), and app bar layouts
- **[Themes](/features/themes)** - Custom themes, fonts, and colors
- **[Internationalization](/features/internationalization)** - Multi-language support
- **[Cookie Consent](/features/cookie-consent)** - Privacy and cookie management
- **[Storage](/features/storage)** - Settings → Storage quota (only when configured)

## Tips

- Prefer `shellui.config.json` with `$schema` for autocomplete and validation
- Use `${VAR}` / `${VAR:-default}` for CLI/build-time env overrides (baked into the frontend on build — no runtime override; do not store secrets)
- Use `shellui config migrate` to convert existing TypeScript configs
- Use `shellui config split` / `unsplit` for large configs
- The CLI automatically handles hot reloading during development
- Configuration changes trigger automatic server restarts
- Production builds are optimized and ready for deployment
- Check the terminal output for server URLs and build status

## Troubleshooting

### Command Not Found

If you see `command not found: shellui`, ensure the CLI is installed:

```bash
npm install -g @shellui/cli
```

Or use `npx`:

```bash
npx shellui start
```

### Configuration Not Found

Ensure `shellui.config.json` exists in your project root (or split / TypeScript config). Run `shellui init` to create one.

### Port Already in Use

Change the port in your configuration file:

```json
{
  "port": 5000
}
```

### TypeScript Config Not Loading

TypeScript config is an advanced fallback used only when no JSON or split config is present. Ensure the file exports a serializable object (`export default` or `export const config`). For declarative config, prefer JSON and `shellui config migrate`.

```bash
npm install -D typescript
```
