# Desktop App

Ship your ShellUI app as a native desktop application. The CLI uses [Tauri 2](https://v2.tauri.app/) under the hood today — the desktop wrapper is generated into `dist/app/` so you never manage native project files in your repo.

## Prerequisites

**Required before running desktop commands:**

1. **[Rust](https://www.rust-lang.org/tools/install)** – Install via [rustup](https://rustup.rs/):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

   **Verify installation:**

   ```bash
   cargo --version
   rustc --version
   ```

   If these commands fail, restart your terminal or run `source ~/.cargo/env`.

2. **[Node](https://nodejs.org/)** 18+ and a package manager (npm, pnpm, or yarn)

**Platform-specific requirements** (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)):

- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Microsoft Visual Studio C++ Build Tools, WebView2
- **Linux**: webkit2gtk, and other dev packages (see Tauri docs)

> **Note**: If you see `failed to run 'cargo metadata'`, Rust/Cargo is not installed or not in your PATH.

## Quick start

From your ShellUI project directory:

```bash
# Development: ShellUI server + native window
shellui dev --app

# Production: web build + native desktop app (.app on macOS)
shellui build --app

# Production + macOS DMG installer (for distribution)
npx shellui build --app --bundles app,dmg
```

On first run, the CLI:

1. Generates `dist/app/` with the desktop wrapper (implementation-specific project files)
2. Installs desktop build dependencies (e.g. `@tauri-apps/cli`) if not already present
3. Syncs `shellui.config.ts` (title, icon, port) into the generated wrapper

`shellui start --app` works the same as `shellui dev --app`.

## Build output layout

| Command                                 | Output                                                |
| --------------------------------------- | ----------------------------------------------------- |
| `shellui build`                         | `dist/web/` — static site for hosting                 |
| `shellui build --app`                   | `dist/web/` + `.app` bundle (macOS) under `dist/app/` |
| `shellui build --app --bundles app,dmg` | Above + `.dmg` installer (macOS)                      |

Everything under `dist/` is generated locally and gitignored — nothing to commit or hand-edit.

## Configuration

The CLI syncs these fields from `shellui.config.ts`:

| Config field | Use in desktop app                         |
| ------------ | ------------------------------------------ |
| `title`      | Window title and app name                  |
| `appIcon`    | App icon                                   |
| `port`       | Dev server URL (`http://localhost:<port>`) |

No extra config is needed for desktop vs web. The CLI sets the build target automatically when you use `--app`. Your `shellui.config.ts` stays the same for both.

## Commands

| Command                                 | Description                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `shellui dev --app`                     | Start ShellUI dev server and open the native window                               |
| `shellui build --app`                   | Build web app to `dist/web/`, then build the native desktop app (`.app` on macOS) |
| `shellui build --app --bundles app,dmg` | Same, plus a macOS `.dmg` installer for distribution                              |

```bash
shellui dev --app ./my-project
shellui dev --app --host
shellui build --app ./my-project
npx shellui build --app --bundles app,dmg
```

## Bundle targets

When you run `shellui build --app`, the CLI passes a `--bundles` flag to the desktop bundler (Tauri today). By default only the **`app`** target is built — on macOS that is a `.app` you can run directly from:

```
dist/app/src-tauri/target/release/bundle/macos/
```

This default avoids flaky macOS DMG packaging during local development.

To also produce a **`.dmg` disk image** (for distribution or notarization), pass `--bundles app,dmg`:

```bash
npx shellui build --app --bundles app,dmg
```

The DMG is written under `dist/app/src-tauri/target/release/bundle/dmg/`.

Other [Tauri bundle targets](https://v2.tauri.app/reference/config/#bundleconfig) (`deb`, `rpm`, `appimage`, `msi`, `nsis`, …) can be passed the same way if you need them on Linux or Windows.

**`package.json` scripts example:**

```json
{
  "scripts": {
    "build:app": "shellui build --app",
    "build:app:dmg": "shellui build --app --bundles app,dmg"
  }
}
```

## Development

1. Run `shellui dev --app` from your project root.
2. The CLI generates or updates `dist/app/`, syncs config, and starts the desktop dev environment.
3. The ShellUI dev server starts (via `shellui start --target tauri`) and a native window opens pointing at it.
4. Edit your app or config; the web app hot-reloads as usual.

## Production build

1. Run `shellui build --app` from your project root.
2. Web assets are built to `dist/web/`, then the native desktop app is built.
3. On macOS, the `.app` bundle is under `dist/app/src-tauri/target/release/bundle/macos/`.

For a macOS **DMG installer** (distribution):

```bash
npx shellui build --app --bundles app,dmg
```

See [Bundle targets](#bundle-targets) for details and other platforms.

## Icons

Icon setup runs automatically during sync:

1. Copies your icon from `appIcon` or `static/favicon.svg`
2. Generates platform-specific icons when the source is SVG
3. Falls back to bundled defaults if no icon is configured

## Project layout

```
my-project/
├── shellui.config.ts      # Shared config for web and desktop
├── static/                  # Optional assets
└── dist/                    # Generated (gitignored)
    ├── web/                 # Web build
    └── app/                 # Desktop wrapper (regenerated by --app)
```

You only maintain `shellui.config.ts` and your static assets. The desktop wrapper in `dist/app/` is an implementation detail — today Tauri, swappable without changing your workflow.

## ShellUI monorepo

When developing ShellUI itself, the monorepo provides `pnpm tauri:dev` and `pnpm tauri:build` via `tools/tauri/`. For apps built with the published CLI, use `shellui dev --app` and `shellui build --app`.

## Troubleshooting

### `failed to run 'cargo metadata'`

Rust/Cargo is not installed or not in PATH. Install via [rustup](https://rustup.rs/) and restart your terminal.

### `failed to open icon .../icon.png`

Regenerate the desktop wrapper:

```bash
rm -rf dist/app
shellui dev --app
```

### `bundle_dmg.sh` failed (macOS)

**What happened:** The app itself likely built successfully. Tauri then tries to create a `.dmg` disk image installer using `bundle_dmg.sh` — that optional packaging step failed. This is a [known flaky step](https://github.com/tauri-apps/tauri/issues/4995) on macOS (AppleScript, disk mounting, CI quirks).

**Check for your app:** look for `dist/app/src-tauri/target/release/bundle/macos/*.app` — you can run it directly.

**Default behavior:** `shellui build --app` now builds the `.app` bundle only (skips DMG) for a reliable local build.

**For a DMG installer** (distribution):

```bash
shellui build --app --bundles app,dmg
```

If DMG still fails, try unmounting stale volumes: `hdiutil info` then `hdiutil detach /dev/diskX`.
