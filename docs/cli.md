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
- `shellui.backend.config.json` (authentication / API)
- `shellui.administration.config.json`
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
```

**Description:**

- Starts a Vite development server with hot module replacement
- Automatically opens your browser (on first start)
- Watches for configuration file changes and restarts automatically
- Uses the port specified in your configuration (default: 3000)
- With `--app`, starts a native desktop development environment (see [Desktop app](/tauri))

**Options:**

- `root` (optional): Project root directory (default: current directory)
- `--host`: Listen on `0.0.0.0` so the app can be accessed from other devices on your network (e.g. via your machine’s LAN IP)
- `--app`: Start as a native desktop app. On first run, generates `dist/app/` (desktop wrapper) and installs desktop build tools if needed.
- `--target <web|tauri>`: Build target injected at compile time (default: `web`). Set to `tauri` for desktop-specific behavior (e.g. disable service worker). Automatically applied when using `--app`.

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
```

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
- With `--app`, builds a native desktop app (web assets to `dist/web/`, desktop wrapper and bundles under `dist/app/`)

**Options:**

- `root` (optional): Project root directory (default: current directory)
- `--app`: Build the desktop app. Generates `dist/app/` on first run and installs desktop build tools if needed.
- `--bundles <targets>`: Desktop bundle format(s) when using `--app` (comma-separated). Default: `app` (e.g. `.app` on macOS). Use `app,dmg` on macOS to also produce a `.dmg` installer. See [Desktop app — Bundle targets](/tauri#bundle-targets).
- `--target <web|tauri>`: Build target injected at compile time (default: `web`). Set to `tauri` for desktop builds. Automatically applied when using `--app`.

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

## Configuration

Shellui uses a JSON configuration file by default. The CLI looks for config in this order:

1. `shellui.config.json` (single file)
2. Split files: `shellui.<name>.config.json` (when no main JSON file is present)
3. `shellui.config.ts` (advanced, code-based configuration)

You cannot use a main JSON file and split files at the same time. Configuration is validated against the JSON Schema shipped with `@shellui/core` (`schemas/shellui.config.schema.json`). Invalid config fails at load time with actionable errors.

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

1. The specified `root` directory (if provided)
2. The current working directory

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
