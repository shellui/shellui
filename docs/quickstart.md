# Quick Start Guide

Get up and running with Shellui in minutes. This guide will walk you through creating your first Shellui application.

## Prerequisites

- Node.js 18.0.0 or higher
- Shellui CLI installed ([Installation Guide](/installation))

## Step 1: Create Your Project

Create a new directory for your Shellui application:

```bash
mkdir my-shellui-app
cd my-shellui-app
```

Initialize a Node.js project (optional, but recommended):

```bash
npm init -y
```

## Step 2: Install Shellui CLI

Install the Shellui CLI as a dev dependency:

```bash
npm install --save-dev @shellui/cli
```

Or install globally:

```bash
npm install -g @shellui/cli
```

## Step 3: Create Configuration File

Create a configuration file in your project root. You can generate one with the CLI or create it manually.

### Option A: Generate with shellui init (recommended)

From your project directory, run:

```bash
shellui init
```

This creates a `shellui.config.json` with sensible defaults (port, title, layout, and sample navigation including Home and Settings), plus a `$schema` reference for editor autocomplete. To overwrite an existing config, use `shellui init --force`.

If you still have a TypeScript config from an older project, run `shellui config migrate` to convert it.

Add a `static/` folder with `favicon.svg`, `logo.svg`, and icons (e.g. `static/icons/home.svg`, `static/icons/settings.svg`) to customize assets, then skip to [Step 4: Start the Development Server](#step-4-start-the-development-server).

### Option B: Create shellui.config.json manually

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
    },
    {
      "label": "About",
      "path": "about",
      "url": "https://example.com/about",
      "icon": "/icons/info.svg"
    }
  ]
}
```

### Configuration Options

- **port** (number, optional): Port number for the development server (default: 3000)
- **title** (string, optional): Application title displayed in the UI
- **backend** (object, optional): Backend config for auth/API communication (default: undefined). See [Backend](/backend) and [Authentication](/features/authentication).
  - **type** (`"shellui"` | `"supabase"`): Backend provider
  - **url** (string): Base API URL
  - **login** (object, optional): `methods` and `oauthProviders` for the login page
- **navigation** (array, optional): Array of navigation items with:
  - **label** (string): Display text for the navigation item
  - **path** (string): Unique path identifier
  - **url** (string): URL to navigate to
  - **icon** (string, optional): Icon name for the navigation item
  - **hideWhenLoggedOut** (boolean, optional): Hide item from navigation while signed out
  - **requiresAuth** (boolean, optional): Require authentication for direct route access, redirects to `/login?next=...`
- **legalDocuments** (object, optional): Markdown strings for public legal pages and Settings. See [Legal documents](/features/legal-documents).
- **storage** (object, optional): Storage-service URL. Settings → Storage is shown only when this is configured. See [Storage](/features/storage).

String values may use `${VAR}` or `${VAR:-default}` for environment overrides (resolved at load time). See [CLI — Environment variable substitution](/cli#environment-variable-substitution).

Store config outside the project root with `--config ./config` (or `SHELLUI_CONFIG`). See [CLI — Custom config location](/cli#custom-config-location).

## Step 4: Start the Development Server

Run the development server:

```bash
shellui dev
```

Or if installed locally:

```bash
npx shellui dev
```

`shellui start` works the same way — `dev` is an alias for `start`.

The server will:

- Start on the configured port (default: 3000)
- Automatically open your browser
- Watch for configuration file changes and restart automatically
- Display the server URL in the terminal

Use `shellui dev --host` to listen on `0.0.0.0` and access the app from other devices on your network.

To run as a native desktop app, see [Tauri](/tauri) and use `shellui dev --app`.

You should see output like:

```
Starting Shellui...
Loaded JSON config from /path/to/shellui.config.json
👀 Watching config file: /path/to/shellui.config.json

  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:4000/
  ➜  Network: use --host to expose
```

## Step 5: Build for Production

When you're ready to build your application for production:

```bash
shellui build
```

This will:

- Build your Shellui application
- Resolve `${ENV}` placeholders at build time and embed a frozen config in the bundle
- Write `dist/web/shellui.config.json` (resolved values only — public, not overridable at runtime)
- Output the production files to the `dist/web/` directory
- Optimize assets for production

The built files will be in `dist/web/` and can be deployed to any static hosting service.

## Project Structure

A typical Shellui project structure looks like:

```
my-shellui-app/
├── shellui.config.json
├── package.json
├── static/                # Optional static assets
├── dist/                  # Generated build output (gitignored)
│   ├── web/               # Web build
│   └── app/               # Desktop wrapper (--app)
└── node_modules/
```

## Shell plus an embedded app

The CLI only builds the **shell**. Your microfrontend is a normal app (Vite, Next, whatever) with its own scripts. Both can live in the **same package** — one `package.json`, one `pnpm install`.

The [playground](https://github.com/shellui/playground) is that pattern: Shellui CLI for the host, Vite for the iframe demo. One `pnpm start` runs both:

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

`start:app` is an escape hatch. `shellui start --no-run` is shell-only. Flags `--run` / `--follow` override `dev`. See [CLI — Companion process](/cli#companion-process).

`shellui start` / `shellui build` are isolated from your app: they do not load `vite.config.*`, `postcss.config.*`, `tsconfig.json`, or `VITE_*`. Tailwind only scans `@shellui/core`. The shell cache is `node_modules/.vite-shellui`, so a colocated Vite app can keep the default `node_modules/.vite` (or its own `cacheDir`). See [CLI — Tooling isolation](/cli#tooling-isolation).

Point navigation `url`s at the Vite origin in development (for example `http://localhost:5173/#/`) and at the built app path in production (playground writes `dist/web/app/` and sets `PLAYGROUND_APP_URL=/app`). Use [`@shellui/sdk`](/sdk) inside the iframe.

## Next Steps

- **[Tauri](/tauri)** — Ship as a native desktop app with `shellui dev --app`
- **[Backend](/backend)** — Choose Supabase, the Shellui identity service, or no backend
- **[Authentication](/features/authentication)** — Login page, sessions, and guarded routes
- **[Navigation](/features/navigation)** — Configure navigation menus
- **[CLI Reference](/cli)** — Commands and configuration options

## Troubleshooting

### Port Already in Use

If the default port is already in use, change it in your configuration:

```json
{
  "port": 5000
}
```

### Configuration Not Loading

- Ensure `shellui.config.json` is in your project root (or run `shellui init`)
- Check that the file is valid JSON and matches the schema (`$schema` in the file)
- If you still use TypeScript config, ensure no JSON/split files take precedence and that the export is serializable

### Build Errors

- Ensure all dependencies are installed: `npm install`
- Check that your configuration file is valid
- Review error messages in the terminal for specific issues
