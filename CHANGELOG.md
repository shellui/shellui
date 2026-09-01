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

### 📚 Documentation

- Document running the shell CLI and an iframe Vite app in one package, using the playground as the example.

### ✨ Feature

- **Theming v1:** curated themes as versioned OKLCH JSON (47 themes including Shellui brand, shadcn defaults, and [tweakcn](https://tweakcn.com) community palettes), flexible config (`theme` / `themes` / `themesDir` / `activeTheme`), shadcn-compatible tokens, and a scaled Appearance theme selector.
- **Sidebar layout:** rebuild on the current shadcn/ui sidebar primitives — desktop icon-collapse + rail (`⌘B` / `Ctrl+B`), drag-to-resize when expanded (200–480px), mobile sheet, and themed CSS variables. Custom mobile bottom navigation removed.
- **Desktop app chrome:** macOS Tauri windows use an overlay titlebar (traffic lights vertically centered in the 38px chrome). When the sidebar is collapsed, a full-width 38px top bar holds Back/Forward + open-sidebar; when expanded, those controls stay in the sidebar header. A full-width invisible 38px top drag strip is mounted at the app root so it works on every page (including error screens). Back/Forward restore iframe and shell history so login pages in embedded apps are not a dead end.
- **App-bar layout:** 38px chrome bar with text start links (left sheet on mobile), title-only brand (no logo), icon end links, and the same Tauri traffic-light / Back/Forward / drag treatment as the sidebar.
- **Identity-hosted login flow:** shell and CLI clients use identity-service authorize → provider callback → account confirmation → token bounce. Shell `OAuthCallbackView` accepts fragment landings from identity (`hashHasOAuthTokens`); CLI `shellui login` opens authorize without `provider` so identity shows the method picker (`--provider` skips it). Loopback callbacks no longer require a running shell `loginUrl`.

### 🐛 Bug Fixes

- **Auth token on deep links:** site-root embedded apps (e.g. Files at `http://localhost:5175/`) still receive the JWT when the iframe loads a path deep link (`/company/…`), so refresh on `/files/company/…` stays signed in.
- **CLI isolation:** `shellui start` / `build` use an inline Vite config (`configFile: false`) so a colocated app’s `vite.config`, PostCSS, Tailwind, `tsconfig`, and `VITE_*` never affect the shell. Tailwind scans only `@shellui/core`. Cache is `node_modules/.vite-shellui` (not `node_modules/.vite`).
- **Dev cache:** a colocated app Vite (default `node_modules/.vite`) no longer overwrites the shell’s prebundled deps (e.g. Settings failed to load `react-markdown`).

### 🚨 Changed

- CSS variables are full colors (`oklch(...)` / hex) consumed via `var(--token)` (no longer HSL channel triples).
- Official default theme is **shellui** (gold brand). AI-generated zinc/slate/… palettes removed.
- `shellui init` injects `theme: "shellui"`.

### 📚 Documentation

- Add Shellui brand favicon (ICO + PNG sizes) to the Docusaurus docs site.
- Rewrite themes docs for OKLCH JSON themes and the config API; credit [tweakcn](https://tweakcn.com) as the recommended theme designer and note shadcn / other shared-theme platforms.
- Document sidebar desktop collapse and mobile sheet behavior.
- Document identity-hosted OAuth login for `shellui login` (method picker, confirmation, loopback callback).

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
