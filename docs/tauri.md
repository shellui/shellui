# Tauri Desktop App

Ship your ShellUI app as a native desktop application using [Tauri 2](https://v2.tauri.app/). The Tauri package wraps your ShellUI web app in a minimal native window and uses values from `shellui.config.ts` (title, icon, port).

## Prerequisites

**Required before running any Tauri commands:**

1. **[Rust](https://www.rust-lang.org/tools/install)** – Install via [rustup](https://rustup.rs/):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   
   **What to expect:**
   - The installer will prompt you to choose installation options (defaults are usually fine)
   - After installation, you'll see a message like: `Rust is installed now. Great!`
   - You may need to restart your terminal or run `source ~/.cargo/env` to add Rust to your PATH
   
   **Verify installation:**
   ```bash
   cargo --version  # Should print something like: cargo 1.xx.x (xxxxx xxxx-xx-xx)
   rustc --version  # Should print something like: rustc 1.xx.x (xxxxx xxxx-xx-xx)
   ```
   
   If these commands fail, restart your terminal or run:
   ```bash
   source ~/.cargo/env
   ```

2. **[Node](https://nodejs.org/)** 18+ and **[pnpm](https://pnpm.io/)** (recommended) or npm

**Platform-specific requirements** (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)):

- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Microsoft Visual Studio C++ Build Tools, WebView2
- **Linux**: webkit2gtk, and other dev packages (see Tauri docs)

> **Note**: If you see `failed to run 'cargo metadata'` or `No such file or directory (os error 2)`, Rust/Cargo is not installed or not in your PATH. Install Rust via rustup and restart your terminal.

## Installation

From the repository root:

```bash
pnpm install
pnpm tauri:install
```

`tauri:install` installs dependencies for the `@shellui/tauri` package and runs the config sync (see below).

## Configuration

The app is driven by your existing **shellui.config.ts** at the repo root:

| Config field   | Use in Tauri                          |
|----------------|----------------------------------------|
| `title`        | Window title and app name (productName) |
| `appIcon`      | App icon (copied to `tools/tauri/src-tauri/icons/`) |
| `port`         | Dev server URL (`http://localhost:<port>`) |

Sync runs automatically before `tauri dev` and `tauri build`. To sync manually:

```bash
cd tools/tauri && pnpm run sync-config
```

## Commands

Run from the **repository root**:

| Command            | Description                                      |
|--------------------|--------------------------------------------------|
| `pnpm tauri:install` | Install Tauri deps and sync config from shellui.config.ts |
| `pnpm tauri:dev`     | Start ShellUI dev server and open the Tauri window   |
| `pnpm tauri:build`   | Build web app, then build the native desktop app     |

Or from `tools/tauri`:

```bash
pnpm run dev    # same as tauri:dev from root
pnpm run build  # same as tauri:build from root
```

## Development

1. From root: `pnpm tauri:dev`
2. This starts the ShellUI dev server (from `shellui.config.ts`, e.g. port 4000) and opens the Tauri window pointing at it.
3. Edit your app or config; the web app hot-reloads as usual.

## Production build

1. From root: `pnpm tauri:build`
2. This runs `pnpm build` (web assets to `dist/`), then builds the Tauri app. Outputs are under `tools/tauri/src-tauri/target/release/` and in the bundle (e.g. `.app`, `.exe`, `.AppImage`).

## Icons

The sync script automatically handles icon setup:

1. **Copies your icon** from `shellui.config.ts` `appIcon` (or `static/favicon.svg`) to `tools/tauri/src-tauri/icons/`
2. **If it's an SVG**, automatically runs `tauri icon` to generate platform-specific icons (PNG, ICO, ICNS) for all platforms
3. **Updates `tauri.conf.json`** with the generated icon paths

**What gets generated**:
- `32x32.png`, `128x128.png`, `128x128@2x.png` (for Linux/Windows)
- `icon.icns` (for macOS)
- `icon.ico` (for Windows)

**Manual icon generation**: If you need to regenerate icons manually (e.g., after updating the source SVG):

```bash
cd tools/tauri
pnpm exec tauri icon src-tauri/icons/icon.svg
```

See [Tauri icons documentation](https://v2.tauri.app/develop/icons/) for more details.

## Layout

- **tools/tauri/** – Tauri app (lives under `tools/` with other app generators, e.g. future Electron)
  - **package.json** – scripts and `@tauri-apps/cli` / `@tauri-apps/api`
  - **scripts/sync-shellui-config.mjs** – reads `shellui.config.ts`, updates `tauri.conf.json`, copies icon
  - **src-tauri/** – Rust project and Tauri config
    - **tauri.conf.json** – window title, dev URL, build paths, icon (updated by sync)
    - **src/** – minimal Rust entry (no custom logic)
    - **capabilities/** – default capability for the main window

Configuration is kept minimal on purpose; extend `tauri.conf.json` or add Tauri plugins as needed.

## Version control (what to commit)

**Yes, commit the `tools/tauri` folder**, including `src-tauri/`, but not everything inside it:

| Commit | Ignore (in `.gitignore`) |
|--------|---------------------------|
| `src-tauri/Cargo.toml`, `build.rs`, `tauri.conf.json` | `src-tauri/target/` (build output) |
| `src-tauri/src/`, `src-tauri/capabilities/` | `src-tauri/gen/` (Tauri-generated schemas) |
| `src-tauri/icons/icon.svg` (source icon) | Generated icons: `*.png`, `*.ico`, `*.icns`, `icons/android/`, `icons/ios/` |
| `src-tauri/Cargo.lock` (reproducible builds) | |

Generated icons and `target/` are recreated when you run `pnpm run sync-config` and `pnpm tauri:dev` or `pnpm tauri:build`. The `.gitignore` in `tools/tauri/` is already set up for this.

## Troubleshooting

### `failed to run 'cargo metadata'` or `No such file or directory (os error 2)`

**Problem**: Rust/Cargo is not installed or not in your PATH.

**Solution**:
1. Install Rust via [rustup](https://rustup.rs/):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   The installer will guide you through the setup. Choose the default options if unsure.

2. After installation completes, you'll see: `Rust is installed now. Great!`
   
3. **Important**: Restart your terminal or reload your shell config to add Rust to PATH:
   ```bash
   source ~/.cargo/env  # or restart terminal
   ```

4. Verify `cargo` is available:
   ```bash
   cargo --version
   ```
   You should see output like `cargo 1.xx.x (xxxxx xxxx-xx-xx)`. If you get "command not found", restart your terminal.

5. Try `pnpm tauri:dev` again. The first run may take a while as Rust downloads and compiles dependencies.

### `failed to open icon .../icon.png: No such file or directory`

**Problem**: Tauri is looking for a PNG/ICO/ICNS icon file that doesn't exist. This can happen if:
- The sync script failed to generate icons (e.g., Tauri CLI not installed)
- Icon files were deleted manually

**Solution**:
1. Run the sync script to regenerate icons:
   ```bash
   cd tools/tauri && pnpm run sync-config
   ```
   This will copy your icon and automatically generate platform icons if it's an SVG.

2. If icon generation fails, ensure Tauri CLI is installed:
   ```bash
   cd tools/tauri
   pnpm install  # ensures @tauri-apps/cli is installed
   pnpm exec tauri icon src-tauri/icons/icon.svg  # manual generation
   ```

3. Try `pnpm tauri:dev` again.

### Other issues

- **macOS**: Ensure Xcode Command Line Tools are installed: `xcode-select --install`
- **Build errors**: See [Tauri troubleshooting](https://v2.tauri.app/develop/troubleshooting/)
- **Icon generation**: Run `pnpm exec tauri icon src-tauri/icons/icon.svg` if bundle icons are missing
