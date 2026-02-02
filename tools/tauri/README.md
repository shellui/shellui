# @shellui/tauri

Tauri 2 desktop app for ShellUI. Wraps the ShellUI web app in a native window and uses **shellui.config.ts** for title, icon, and dev port.

## Prerequisites

**Rust/Cargo must be installed first!** Install via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env  # or restart terminal
cargo --version      # verify installation
```

## Quick start

From the repo root:

```bash
pnpm tauri:install   # install deps + sync config
pnpm tauri:dev       # run dev (ShellUI server + Tauri window)
pnpm tauri:build     # build web app + native app
```

See [Tauri docs](../../docs/tauri.md) for full prerequisites and troubleshooting.
