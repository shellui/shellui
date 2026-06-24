# @shellui/tauri

Tauri 2 desktop app for the ShellUI monorepo. Wraps the ShellUI web app in a native window and uses **shellui.config.ts** for title, icon, and dev port.

> **For apps built with the ShellUI CLI**, use `shellui dev --app` and `shellui build --app` instead. See [Tauri docs](../../docs/tauri.md).

## Prerequisites

**Rust/Cargo must be installed first!** Install via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env  # or restart terminal
cargo --version      # verify installation
```

## Quick start (monorepo)

From the repo root:

```bash
pnpm tauri:install   # install deps + sync config
pnpm tauri:dev       # run dev (ShellUI server + Tauri window)
pnpm tauri:build     # build web app + native app
```

See [Tauri docs](../../docs/tauri.md) for full prerequisites and troubleshooting.
