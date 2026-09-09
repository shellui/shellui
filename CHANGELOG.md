# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!---
## [Unreleased] - yyyy-mm-dd

### ✨ Feature – for new features
### 🛠 Improvements – for general improvements
### 🚨 Changed – for changes in existing functionality
### ⚠️ Deprecated – for soon-to-be removed features
### 📚 Documentation – for documentation update
### 🗑 Removed – for removed features
### 🐛 Bug Fixes – for any bug fixes
### 🔒 Security – in case of vulnerabilities
### 🏗 Chore – for tidying code

See for sample https://raw.githubusercontent.com/favoloso/conventional-changelog-emoji/master/CHANGELOG.md
-->

## [v0.5.0] - Work in progress

### 🛠 Improvements

- **Desktop icons:** Tauri dock/taskbar icons use the opaque Shellui mark from `static/icon.png`, padded for native dock sizing.
- **Desktop config:** optional root `tauri.conf.json` for `productName`, `identifier`, and icon; Cargo name stays in sync for Dock / Cmd-Tab.
- **Traffic-light inset:** reserved left padding for macOS window controls only in a live Tauri webview, not fullscreen or browser tabs.
- **Desktop history buttons:** back/forward stay available in Tauri fullscreen; app-bar shows them only in a live Tauri webview.

### ✨ Feature

- **CLI companion:** `shellui start` can spawn or follow a colocated app via `dev.run` / `dev.url` (or `--run` / `--follow` / `--shell-only`).
- **Theming v1:** curated OKLCH JSON themes (47 including Shellui, shadcn, and [tweakcn](https://tweakcn.com)), flexible config, and Appearance theme selector.
- **Sidebar layout:** rebuild on shadcn sidebar — icon-collapse + rail (`⌘B`), drag-to-resize, mobile sheet; custom mobile bottom nav removed.
- **Desktop app chrome:** macOS overlay titlebar, collapsed top bar with Back/Forward, full-width drag strip, and iframe/shell history restore.
- **App-bar layout:** 42px chrome with text start links, title-only brand, icon end links, and the same Tauri treatment as sidebar.
- **Identity-hosted login:** authorize → callback → confirmation → token bounce; CLI `shellui login` opens the identity method picker (`--provider` skips it).

### 🐛 Bug Fixes

- **Mobile / iOS height:** shells and overlays use `--shellui-app-height` (`100dvh`) instead of `h-screen` / viewport hacks; standalone via `@media (display-mode: standalone)`.
- **Mobile drawers:** `openDrawer` left/right/top presents as a bottom sheet below 768px.
- **Drawer drag handle:** remove stacked Vaul default + custom bar so only one themed handle shows.
- **Alert dialogs (mobile):** OK/confirm/delete/cancel dialogs geometrically centered with safe-area-aware sizing.
- **Mobile openModal sheets:** dynamic-sizing modals always use full viewport width.
- **Safe areas (iPhone):** cookie consent, alerts, sidebar, titlebar, toasts, and upload toaster respect `env(safe-area-inset-*)`.
- **Sidebar / app-bar iframe fill:** shell uses `h-dvh` so the iframe reaches the screen edge.
- **CLI / core Tailwind:** declare `tailwindcss` on cli and core so `@import "tailwindcss"` resolves under pnpm.
- **Docs build:** declare `@docusaurus/theme-common` so swizzled theme files resolve under pnpm.
- **Auth token on deep links:** site-root embedded apps still receive the JWT on path deep links.
- **CLI isolation:** `shellui start` / `build` use inline Vite config so colocated app tooling never affects the shell.
- **Dev cache:** shell cache is `node_modules/.vite-shellui` so colocated Vite no longer overwrites shell deps.

### 🚨 Changed

- CSS variables are full colors (`oklch(...)` / hex) via `var(--token)` (no longer HSL channel triples).
- Official default theme is **shellui** (gold brand); AI-generated zinc/slate/… palettes removed.
- `shellui init` injects `theme: "shellui"`.

### 📚 Documentation

- Document running the shell CLI and an iframe Vite app in one package (playground example).
- Add Shellui brand favicon to the Docusaurus docs site.
- Rewrite themes docs for OKLCH JSON themes and the config API; credit [tweakcn](https://tweakcn.com).
- Document sidebar desktop collapse and mobile sheet behavior.
- Document identity-hosted OAuth login for `shellui login`.

## [0.4.1] - 2026-08-18

### 🐛 Bug Fixes

- Tempiorary fix modalUrl undefined when not localhost or same domain by allowing storage and admin.

## [0.4.0] - 2026-08-16

### ✨ Feature

- **Administration panel:** configure custom admin sidebar navigation via `administration` in `shellui.config.ts` (title, flat nav items, `requiresStaff`, `openIn: 'external'` for Django admin); propagated to the admin app through SDK settings. (#6)
- **Storage:** optional root `storage.url` / `filesUrl` in `shellui.config.ts` are propagated as SDK `settings.storage` so Admin (and later the shell) can use storage-service. Admin shows Storage when `storage.url` is set. Settings → Storage shows the signed-in user's quota when `storage.url` is set; hide it with `storage.showInSettings: false`.
- **Storage SDK:** iframe apps call `shellui.storage` (Supabase-like `{ data, error }` API) for upload, download, list, move, and rename. Requests are forwarded to the root shell, which talks to storage-service with `storage.url`.
- **Company access pending UI:** when identity-service blocks join (`access_pending` / `access_denied`), show a clear “account created, awaiting admin review” screen instead of a generic OAuth failure. Access is per company. (#15)

### 📚 Documentation

- Document company access modes and pending-access UX in authentication docs. (#15)
- Document Settings → Storage: only shown when `storage` is configured, and how to disable it with `showInSettings`.
- Document the SDK file API (`shellui.storage`) with nested-folder samples.

## [0.3.1] - 2026-06-24

### 🛠 Improvements

- Improve **login** next params (#2)
- Improve tauri integration for better developer user experience (9)

### 🐛 Bug Fixes

- Default **adminUrl** value (#1)
- **Navigate** call using sdk fails to default urls (#4)
- Make **Software update** disabled by default and experimental (#5)

## [0.3.0] - 2026-05-13

### ✨ Feature

- **Auth:** added support for Supabase and shellui auth authentication mechanisms.
- **Legal documents:** added support for `legalDocuments` markdown content (`privacyPolicy`, `termsOfService`, `legalNotice`, `dataProcessingAgreement`).

### 🛠 Improvements

- **Router:** added route-aware login flow with `next` redirect support for smoother sign-in transitions.

## [0.2.0] - 2026-02-20

### ✨ Feature

- **Application settings:** navigation items can define a `settings` URL to display their own settings panel in Settings > Applications.
- **Layout:** new **app-bar** layout with a 38px top bar: 9-square + current page name launcher (wrapping icon strip), Back/Forward on Tauri, and icon-only end links
- **CLI:** `shellui init [root]` command to create a `shellui.config.ts` boilerplate (use `--force` to overwrite)

### 🛠 Improvements

- **Themes:** default theme now uses local fonts from `static/fonts/` (Open Sans, Source Serif 4) instead of Google Fonts; theme docs updated for local font setup
- **Navigation:** support `start_url` to redirect "/" and navigation items with path `""` or `"/"` as the start page
- **Navigation:** handling navigation for applications using hash navigation
- Improved **Sentry** error reporting integration
- **CLI:** `shellui start --host` to expose the dev server to the network

### 🐛 Bug Fixes

- **iPad/Radix:** fixed modal/dialog buttons when using Apple Pencil or touch

### 🔒 Security

- **Dependencies:** updated to address security issues

## [0.1.0] - 2026-02-09

### ✨ Feature

- Multiple **layout modes**: **sidebar navigation**, **fullscreen** content view, and **windows desktop mode** with taskbar
- Flexible **navigation menu** with icons, grouped items, and customizable organization
- Open links in different ways: main content area, **modal popups**, **side drawers**, or external browser
- **Side drawer panels** that slide in from any direction (top, bottom, left, right)
- **Multi-language support** with English and French translations
- **Localized interface** with translated navigation labels and UI text
- **Custom themes** with **light** and **dark mode** variants
- **Custom fonts** for headings and body text from external links or local files
- **Toast notifications** with multiple styles: success, error, warning, info, and loading states
- **Alert dialogs** with different button configurations (ok, ok/cancel, ok/cancel/secondary)
- **Modal windows** for displaying content overlays
- **Settings panel** to customize appearance, language preferences, and privacy options
- **Offline support** and **app updates** through service worker
- **Cookie consent management** with categorized privacy controls
- **Error reporting** to help improve app stability
- **Desktop app support** for native applications
- **Responsive design** that adapts to mobile and desktop screens
- Customizable **app branding** with favicon and logo
- **Software updates** with version information and manual update checking in settings
- Customizable **navigation item visibility** for mobile and desktop
