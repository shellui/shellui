# Change log

Notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [Semantic Versioning](https://semver.org/).

<!---
## [Unreleased] - yyyy-mm-dd

### ✨ Feature - for new features
### 🛠 Improvements - for general improvements
### 🚨 Changed - for changes in existing functionality
### ⚠️ Deprecated - for soon-to-be removed features
### 📚 Documentation - for documentation update
### 🗑 Removed - for removed features
### 🐛 Bug Fixes - for any bug fixes
### 🔒 Security - in case of vulnerabilities
### 🏗 Chore - for tidying code

Sample: https://raw.githubusercontent.com/favoloso/conventional-changelog-emoji/master/CHANGELOG.md
-->

## [0.5.1] - Unreleased

### 🔒 Security

- **StorageBridge trusted-frame gate (H-07):** `SHELLUI_STORAGE_REQUEST` is honored only from registered iframe companions that pass the same trusted-frame policy as session JWT sharing (`safeForAuthToken`, admin URLs, `storage.filesUrl`). Untrusted senders receive `403` without storage I/O. Shared helpers live in `features/security/trustedFrames` for upcoming postMessage allowlist work (#60).

### 🐛 Bug Fixes

- **`shellui init` scaffolding:** restore `@shellui/cli` in generated projects; `pnpm build` builds shell + app into deployable `dist/web/` with relative / `${SHELLUI_APP_URL:-…}` companion URLs; restore native framework boilerplate home (drop Welcome to Shellui); default `layout: "fullscreen"`. Also fix deep-route relative asset paths after `base: './'`, Next static export `images.unoptimized`, and stale template READMEs.

## [0.5.0] - 2026-09-16

### ✨ Feature

- **Host detection**: `isHomeScreenPwa()`, `isTauriRuntime()`, and `data-shellui-host` tell Safari Home Screen installs apart from native WKWebView. iOS Home Screen PWAs skip stacked status scrims and `theme-color`. Tauri keeps controlled chrome and CSS safe-area. See the [browser PWA vs native iOS](./docs/tauri.md#browser-pwa-vs-native-ios) notes.
- **Floating chrome actions (SDK)**: `shellui.actions.set` / `clear` declare optional back, title, trailing, and primary FAB chrome. The shell renders them (floating glass or windows title bar), posts `SHELLUI_ACTION` clicks into that iframe only, and clears on shell navigation. Caps: at most 3 trailing visible (rest in `···`), at most 1 primary. Try it in Settings → Develop → Chrome actions. See the [chrome actions guide](./docs/features/chrome-actions.md).
- **`shellui init` frameworks**: Next.js (`create-next-app` App Router JS), Nuxt (nuxi minimal), SvelteKit (`sv create` minimal), and Alpine.js (official Alpine npm + Vite). Companions: Next/Nuxt on `:3000`, SvelteKit/Alpine on `:5173`. Alpine wires `@shellui/sdk/tiny` theme plus `en`/`fr` language sync.
- **Sidebar inset layout**: sidebar twin with a padded, rounded main frame (`layout: "sidebar-inset"`). Select it in Settings → Develop.
- **App-bar inset layout**: app-bar twin with the same inset chrome tray and rounded content frame (`layout: "app-bar-inset"`).
- **CLI companion**: `shellui start` can spawn or follow a colocated app via `dev.run` / `dev.url` (or `--run` / `--follow` / `--shell-only`).
- **Theming v1**: curated OKLCH JSON themes (47, including Shellui, shadcn, and [tweakcn](https://tweakcn.com)), flexible config, and an Appearance theme selector.
- **Sidebar layout**: rebuild on shadcn sidebar - icon-collapse and rail (`⌘B`), drag-to-resize, mobile sheet. Custom mobile bottom nav is gone.
- **Desktop app chrome**: macOS overlay titlebar, collapsed top bar with Back/Forward, full-width drag strip, and iframe/shell history restore.
- **App-bar layout**: 42px chrome with text start links, title-only brand, icon end links, and the same Tauri treatment as sidebar.
- **Identity-hosted login**: authorize → callback → confirmation → token bounce. CLI `shellui login` opens the identity method picker (`--provider` skips it).
- **Desktop icons**: Tauri dock/taskbar icons use the opaque Shellui mark from `static/icon.png`, padded for native dock sizing.
- **Desktop config**: optional root `tauri.conf.json` for `productName`, `identifier`, and icon. Cargo name stays in sync for Dock / Cmd-Tab.
- **Traffic-light inset**: reserved left padding for macOS window controls only in a live Tauri webview, not fullscreen or browser tabs.
- **Host detection (PWA vs Tauri):** `isHomeScreenPwa()` / `isTauriRuntime()` / `data-shellui-host` distinguish Safari Home Screen installs from native WKWebView. iOS Home Screen PWAs skip stacked status scrims and `theme-color`; Tauri keeps controlled chrome + CSS safe-area. See [docs/tauri.md](./docs/tauri.md#browser-pwa-vs-native-ios).
- **Floating chrome actions (SDK):** `shellui.actions.set` / `clear` declare optional back, title, trailing, and primary FAB chrome. Shell renders them (floating glass / windows title bar), posts `SHELLUI_ACTION` clicks into that iframe only, and clears on shell navigation. Caps: ≤3 trailing visible (rest in `···`), ≤1 primary. Try via Settings → Develop → Chrome actions. See [docs/features/chrome-actions.md](./docs/features/chrome-actions.md).
- **`shellui init` frameworks:** Next.js (`create-next-app` App Router JS), Nuxt (nuxi minimal), SvelteKit (`sv create` minimal), and Alpine.js (official Alpine npm + Vite). Companions: Next/Nuxt → `:3000`, SvelteKit/Alpine → `:5173`. Alpine wires `@shellui/sdk/tiny` theme + en/fr language sync.
- **Sidebar inset layout:** sidebar twin with a padded, rounded main frame (`layout: "sidebar-inset"`); selectable from Settings → Develop.
- **App-bar inset layout:** app-bar twin with the same inset chrome tray and rounded content frame (`layout: "app-bar-inset"`).
- **CLI companion:** `shellui start` can spawn or follow a colocated app via `dev.run` / `dev.url` (or `--run` / `--follow` / `--shell-only`).
- **Theming v1:** curated OKLCH JSON themes (47 including Shellui, shadcn, and [tweakcn](https://tweakcn.com)), flexible config, and Appearance theme selector.
- **Sidebar layout:** rebuild on shadcn sidebar — icon-collapse + rail (`⌘B`), drag-to-resize, mobile sheet; custom mobile bottom nav removed.
- **Desktop app chrome:** macOS overlay titlebar, collapsed top bar with Back/Forward, full-width drag strip, and iframe/shell history restore.
- **App-bar layout:** 42px chrome with text start links, title-only brand, icon end links, and the same Tauri treatment as sidebar.
- **Identity-hosted login:** authorize → callback → confirmation → token bounce; CLI `shellui login` opens the identity method picker (`--provider` skips it).

### 📚 Documentation

- **Chrome actions:** SDK reference + feature guide; Develop settings test buttons.
- **Framework starters:** dedicated docs page for `shellui init` companions (React, Vue, Angular, Next.js, Nuxt, SvelteKit, Alpine.js, empty) with ports, theme/i18n wiring, and framework icons. Cross-linked from Create a project and CLI.

### 🐛 Bug Fixes

- **Upload toaster:** auto-dismiss ~2.5s after all uploads succeed; keep open on failure so errors stay readable.
- **SDK layout chrome:** inject `.shellui-apply-layout-chrome-pad` styles into the iframe app document so auto-padding works without shipping `@shellui/core` CSS.

### 🛠 Improvements

- **`shellui init` companions**: JS framework templates (`react`, `vue`, `angular`, `next`, `nuxt`, `svelte`, `alpine`) use `@shellui/sdk/tiny` with theme sync, `en`/`fr` i18n, and a Shellui-integrated home (not stock Vite/Next hello worlds).
- **Desktop history buttons**: back/forward stay available in Tauri fullscreen. App-bar shows them only in a live Tauri webview.

### 🚨 Changed

- CSS variables are full colors (`oklch(...)` / hex) via `var(--token)`. They are no longer HSL channel triples.
- Official default theme is **shellui** (gold brand). AI-generated zinc/slate palettes are removed.
- `shellui init` injects `theme: "shellui"`.

### 🐛 Bug Fixes

- **Upload toaster**: auto-dismiss ~2.5s after all uploads succeed. Stay open on failure so errors stay readable.
- **SDK layout chrome**: inject `.shellui-apply-layout-chrome-pad` styles into the iframe app document so auto-padding works without shipping `@shellui/core` CSS.
- **Mobile / iOS height**: shells and overlays use `--shellui-app-height` (`100dvh`) instead of `h-screen` / viewport hacks. Standalone via `@media (display-mode: standalone)`.
- **Mobile drawers**: `openDrawer` left/right/top presents as a bottom sheet below 768px.
- **Drawer drag handle**: remove stacked Vaul default + custom bar so only one themed handle shows.
- **Alert dialogs (mobile)**: OK/confirm/delete/cancel dialogs geometrically centered with safe-area-aware sizing.
- **Mobile openModal sheets**: dynamic-sizing modals always use full viewport width.
- **Safe areas (iPhone)**: cookie consent, alerts, sidebar, titlebar, toasts, and upload toaster respect `env(safe-area-inset-*)`.
- **Sidebar / app-bar iframe fill**: shell uses `h-dvh` so the iframe reaches the screen edge.
- **CLI / core Tailwind**: declare `tailwindcss` on cli and core so `@import "tailwindcss"` resolves under pnpm.
- **Docs build**: declare `@docusaurus/theme-common` so swizzled theme files resolve under pnpm.
- **Auth token on deep links**: site-root embedded apps still receive the JWT on path deep links.
- **CLI isolation**: `shellui start` / `build` use inline Vite config so colocated app tooling never affects the shell.
- **Dev cache**: shell cache is `node_modules/.vite-shellui` so colocated Vite no longer overwrites shell deps.

### 📚 Documentation

- **Chrome actions**: SDK reference and feature guide; Develop settings test buttons.
- Document running the shell CLI and an iframe Vite app in one package (playground example).
- Add Shellui brand favicon to the Docusaurus docs site.
- Rewrite themes docs for OKLCH JSON themes and the config API; credit [tweakcn](https://tweakcn.com).
- Document sidebar desktop collapse and mobile sheet behavior.
- Document identity-hosted OAuth login for `shellui login`.

## [0.4.1] - 2026-08-18

### 🐛 Bug Fixes

- Temporary fix for `modalUrl` undefined when the app is not localhost or same-domain: allow storage and admin.

## [0.4.0] - 2026-08-16

### ✨ Feature

- **Administration panel**: configure custom admin sidebar navigation via `administration` in `shellui.config.ts` (title, flat nav items, `requiresStaff`, `openIn: 'external'` for Django admin). Propagated to the admin app through SDK settings. (#6)
- **Storage**: optional root `storage.url` / `filesUrl` in `shellui.config.ts` propagate as SDK `settings.storage` so Admin (and later the shell) can use storage-service. Admin shows Storage when `storage.url` is set. Settings → Storage shows the signed-in user's quota when `storage.url` is set; hide it with `storage.showInSettings: false`.
- **Storage SDK**: iframe apps call `shellui.storage` (Supabase-like `{ data, error }` API) for upload, download, list, move, and rename. Requests go to the root shell, which talks to storage-service with `storage.url`.
- **Company access pending UI**: when identity-service blocks join (`access_pending` / `access_denied`), show an “account created, awaiting admin review” screen instead of a generic OAuth failure. Access is per company. (#15)

### 📚 Documentation

- Document company access modes and pending-access UX in authentication docs. (#15)
- Document Settings → Storage: only shown when `storage` is configured, and how to disable it with `showInSettings`.
- Document the SDK file API (`shellui.storage`) with nested-folder samples.

## [0.3.1] - 2026-06-24

### 🛠 Improvements

- Improve **login** next params (#2)
- Improve Tauri integration for developer experience (#9)

### 🐛 Bug Fixes

- Default **adminUrl** value (#1)
- **Navigate** via SDK fails on default URLs (#4)
- Make **Software update** disabled by default and experimental (#5)

## [0.3.0] - 2026-05-13

### ✨ Feature

- **Auth**: support for Supabase and Shellui auth.
- **Legal documents**: support for `legalDocuments` markdown content (`privacyPolicy`, `termsOfService`, `legalNotice`, `dataProcessingAgreement`).

### 🛠 Improvements

- **Router**: route-aware login flow with `next` redirect support for smoother sign-in transitions.

## [0.2.0] - 2026-02-20

### ✨ Feature

- **Application settings**: navigation items can define a `settings` URL to show their own panel in Settings > Applications.
- **Layout**: new **app-bar** layout with a 38px top bar: 9-square + current page name launcher (wrapping icon strip), Back/Forward on Tauri, and icon-only end links.
- **CLI**: `shellui init [root]` creates a `shellui.config.ts` boilerplate (use `--force` to overwrite).

### 🛠 Improvements

- **Themes**: default theme uses local fonts from `static/fonts/` (Open Sans, Source Serif 4) instead of Google Fonts; theme docs updated for local font setup.
- **Navigation**: support `start_url` to redirect `/` and navigation items with path `""` or `"/"` as the start page.
- **Navigation**: handle hash navigation for applications.
- Improved **Sentry** error reporting integration.
- **CLI**: `shellui start --host` exposes the dev server to the network.

### 🐛 Bug Fixes

- **iPad/Radix**: fix modal/dialog buttons when using Apple Pencil or touch.

### 🔒 Security

- **Dependencies**: update to address security issues.

## [0.1.0] - 2026-02-09

### ✨ Feature

- Multiple **layout modes**: **sidebar navigation**, **fullscreen** content view, and **windows desktop mode** with taskbar.
- Flexible **navigation menu** with icons, grouped items, and customizable organization.
- Open links in different ways: main content area, **modal popups**, **side drawers**, or external browser.
- **Side drawer panels** that slide in from any direction (top, bottom, left, right).
- **Multi-language support** with English and French translations.
- **Localized interface** with translated navigation labels and UI text.
- **Custom themes** with **light** and **dark mode** variants.
- **Custom fonts** for headings and body text from external links or local files.
- **Toast notifications** with multiple styles: success, error, warning, info, and loading states.
- **Alert dialogs** with different button configurations (ok, ok/cancel, ok/cancel/secondary).
- **Modal windows** for displaying content overlays.
- **Settings panel** to customize appearance, language preferences, and privacy options.
- **Offline support** and **app updates** through service worker.
- **Cookie consent management** with categorized privacy controls.
- **Error reporting** to help improve app stability.
- **Desktop app support** for native applications.
- **Responsive design** that adapts to mobile and desktop screens.
- Customizable **app branding** with favicon and logo.
- **Software updates** with version information and manual update checking in settings.
- Customizable **navigation item visibility** for mobile and desktop.
