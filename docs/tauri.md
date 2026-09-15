---
title: Ship a desktop app
sidebar_label: Desktop App
description: 'Run shellui dev --app and shellui build --app to generate a Tauri 2 wrapper under dist/app/.'
---

Ship the shell as a native desktop app. The CLI uses [Tauri 2](https://v2.tauri.app/) and writes the wrapper into `dist/app/` so you do not commit native project files.

## Browser PWA vs native (iOS) {#browser-pwa-vs-native-ios}

The same React / Vite shell runs in both hosts. Status-bar behavior does **not**:

| Host                     | How it runs        | Top chrome                                                                                                                               |
| ------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Safari / Home Screen PWA | Standalone web app | iOS 26/27 Liquid Glass — system status sampling / gradient. Shellui skips stacking its own status scrims and does not set `theme-color`. |
| Tauri iOS (App Store)    | Native WKWebView   | **No** Home Screen PWA system gradient. You control insets with `viewport-fit=cover` + `env(safe-area-inset-*)` (already in the shell).  |
| Tauri desktop            | Native webview     | Overlay titlebar / traffic lights (macOS).                                                                                               |

Detect the live native shell in app code with `window.__TAURI__` (or Shellui’s `isTauriRuntime()`). Prefer that over the CLI `--target tauri` build flag when deciding UI — a browser tab of a tauri-targeted build must not get native chrome.

```ts
import { isTauriRuntime, isHomeScreenPwa } from '@shellui/core';

if (isTauriRuntime()) {
  // App Store / desktop WKWebView — native-controlled chrome
}

if (isHomeScreenPwa()) {
  // Safari "Add to Home Screen" only
}
```

`html[data-shellui-host]` is set to `browser` | `pwa` | `tauri` for CSS.

**App Store recommendation:** distribute the iOS build via Tauri so you avoid the iOS Home Screen PWA status gradient. Keep the web PWA for install-from-Safari users who accept platform chrome. Always verify on a real iPhone/iPad — Tauri mobile has had its own inset quirks.

The shell document already ships:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover"
/>
```

Layouts pad with `--shellui-safe-area-*` (`env(safe-area-inset-*)`). On iOS WKWebView, if UIKit still shrinks the scroll view, set `contentInsetAdjustmentBehavior = .never` on the webview (e.g. via a Tauri iOS insets plugin) so edge-to-edge paint matches CSS safe-area.

## Prerequisites

1. **Rust** via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Confirm with `cargo --version` and `rustc --version`. If those fail, restart the terminal or run `source ~/.cargo/env`. `failed to run 'cargo metadata'` means Cargo is missing or off PATH.

2. **Node.js** 18+ and a package manager.

Platform extras - see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** Visual Studio C++ Build Tools, WebView2
- **Linux:** webkit2gtk and related packages listed in Tauri docs

## Commands

```bash
shellui dev --app
shellui build --app
npx shellui build --app --bundles app,dmg
```

`shellui start --app` is the same as `dev --app`. On first run the CLI generates `dist/app/`, installs desktop build tools if needed (for example `@tauri-apps/cli`), and syncs root `tauri.conf.json` plus `shellui.config.json` `port` into the wrapper.

| Command                                 | Output                                             |
| --------------------------------------- | -------------------------------------------------- |
| `shellui build`                         | `dist/web/` static site                            |
| `shellui build --app`                   | `dist/web/` plus `.app` on macOS under `dist/app/` |
| `shellui build --app --bundles app,dmg` | Above plus a `.dmg`                                |

Everything under `dist/` is generated and gitignored.

## Configuration

Optional **`tauri.conf.json`** next to `shellui.config.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Shellui",
  "identifier": "com.shellui.app",
  "bundle": {
    "icon": ["static/icon.png"]
  }
}
```

| Field            | Use                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productName`    | Dock / installer / window name for bundled apps. Defaults to `package.json` `name` with the first letter capitalized. During `tauri dev`, macOS uses the Cargo package name (kept in sync from `productName`) |
| `identifier`     | Bundle id. Defaults from the product name                                                                                                                                                                     |
| `bundle.icon`    | Source icon(s) relative to the project root (prefer an opaque `static/icon.png`). The CLI runs `tauri icon`                                                                                                   |
| `app.windows[0]` | Optional window overrides. Overlay titlebar defaults stay unless you override them                                                                                                                            |

From `shellui.config.json`: `port` is the dev URL (`http://localhost:<port>`); `title` is a fallback product name; `favicon` / `appIcon` are icon fallbacks when `bundle.icon` / `static/icon.png` are absent (`appIcon` is last and is a transparent chrome glyph). Prefer root `tauri.conf.json` for dock name and icon; keep `title` / `appIcon` for in-app chrome.

On **macOS**, the window uses an overlay titlebar. Close / minimize / zoom are system traffic lights. Shellui centers them in the 42px sidebar chrome; web controls get a 2px top pad. Traffic-light **horizontal inset** applies only in a live Tauri webview on macOS while the window is **not** native fullscreen (Tauri `plugin:window|is_fullscreen` + `tauri://resize`). Opening the same `--target tauri` URL in a browser, or entering fullscreen, drops that spacing. **Back / Forward** stay in Tauri chrome (including native fullscreen). A full-width invisible 42px top strip (`data-tauri-drag-region`; needs `core:window:allow-start-dragging`) is mounted at the app root. Buttons sit above that strip so they stay clickable. Sidebar **Back** walks iframe history, including out of a login page.

## Bundle targets

`shellui build --app` passes `--bundles` to Tauri. Default is **`app`** only (on macOS, `.app` under `dist/app/src-tauri/target/release/bundle/macos/`). That skips flaky DMG packaging during local builds.

```bash
npx shellui build --app --bundles app,dmg
```

DMG lands under `dist/app/src-tauri/target/release/bundle/dmg/`. Other [Tauri bundle targets](https://v2.tauri.app/reference/config/#bundleconfig) (`deb`, `rpm`, `appimage`, `msi`, `nsis`) work the same way on Linux or Windows.

```json
{
  "scripts": {
    "build:app": "shellui build --app",
    "build:app:dmg": "shellui build --app --bundles app,dmg"
  }
}
```

## Icons

Sync prefers `tauri.conf.json` → `bundle.icon`, then `static/icon.png`, then `favicon` / `static/favicon.svg` (not the transparent `appIcon` chrome glyph). The CLI generates PNG / ICNS / ICO via `tauri icon`, then falls back to bundled defaults. Use a solid-background square for the dock, padded to Apple's ~824/1024 grid on macOS. Keep `appIcon` as the mono mark for sidebar / app-bar chrome.

## Layout

```text
my-project/
├── shellui.config.json
├── static/
└── dist/
    ├── web/
    └── app/
```

When developing Shellui itself, the monorepo exposes `pnpm tauri:dev` and `pnpm tauri:build` via `tools/tauri/`. Published-CLI apps use `shellui dev --app` and `shellui build --app`.

## Troubleshooting

**`failed to open icon .../icon.png`.** Remove `dist/app` and run `shellui dev --app` again.

**`bundle_dmg.sh` failed (macOS).** Look for `.app` under `dist/app/src-tauri/target/release/bundle/macos/` - the app bundle can succeed when DMG packaging fails. Default `--app` skips DMG. If you requested `app,dmg` and it failed, unmount stale volumes (`hdiutil info`, then `hdiutil detach /dev/diskX`). This is a [known flaky Tauri step](https://github.com/tauri-apps/tauri/issues/4995).
