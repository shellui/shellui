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

## [0.7.0-alpha.12] - 2026-10-29

### ✨ Feature

- **CLI:** Set `SHELLUI_DEPLOY_TOKEN` in CI to create and update 7-day previews without a login. The CLI never prints the token, redacts it from errors, and gives clear errors for invalid, revoked, expired and preview-only tokens.

### 🛠 Improvements

- **Core:** One shared divider per layout, as in the layouts redesign kit: a full-width 1px hairline in the sidebar, floating sidebar and windows start menu (it replaces the footer, floating header and start menu borders), none in the sidebar inset footer, and the full-bleed separator in menus. When signed in, the same divider sits above the account block, with 4px above the account row, to separate it from the footer items (not drawn when the account block is the only footer item). Signed-out users keep the login button with no divider.
- **CLI:** `shellui deploy` saves a new preview slug to `hosting.slug` in `shellui.config.json`.
- **CLI:** Credentials are stored per account (keychain entry each, same keys in the 0600 file fallback). Old logins migrate on first use. `shellui logout` clears the current account, `--all` clears every account.

### 📚 Documentation

- **CLI:** Credential storage section describes keychain first, file fallback and per-account keys.

## [0.7.0-alpha.11] - 2026-10-27

### 🛠 Improvements

- **Core:** Sidebar account block: initials or picture, name with email below and an up/down chevron, avatar only when collapsed.
- **Core:** Windows layout: the desktop dot field moves at the website's normal speed, so the motion is visible. Reduced motion keeps the static grid.
- **Core:** Sidebar layout: app name next to the logo (fades out when collapsed), no border under the header, 2px gaps between nav items, inset header pulled flush on the web, collapsed tooltips in foreground colours after 200ms, and the toggle reports `aria-expanded` and `aria-controls`.
- **Core:** Sidebar layout on phones: 48px header with a 40px trigger and the page title centred, and a 52px sheet header with the logo, app name and a "Close menu" button.
- **Core:** App bar: app name next to the logo on the web, the active underline sits on the bar's bottom border, More is a "···" icon button (labelled "More"), and the active item never hides inside More on narrow screens.
- **Core:** App bar: nav items and their menus use plain 16px icons, with no muted tile or letter badge.
- **Core:** Floating layout: the web brand row shows the app name next to the logo (52px row, 36px collapse button), the collapse button uses the "Collapse sidebar" and "Expand sidebar" labels, and the More sheet and tablet More menu group items under their nav group labels.
- **Core:** Windows layout: start menu group labels at 12px / 600 in normal case, a start menu footer with the account row and a Settings button, and icon-only taskbar end items with labels and tooltips.
- **Core:** Fullscreen layout: on phones the content clears the safe areas (top inset plus 12px, sides and bottom by their inset). Nested shells and the macOS strip are unchanged.

### 🚨 Changed

- **Core:** Drawers float above the page: a 12px gap from the window edge (8px plus the safe area on phones), rounded corners, a border and a soft shadow. Phone drawer, modal and More sheets share one look and grab handle. Drawers fade instead of slide under reduced motion.

### 🐛 Bug Fixes

- **Core:** The expanded phone bottom sheet no longer hides its last 60px below the screen.
- **Core:** On phones every drawer opens as a bottom sheet with a grab handle, whatever its direction or dismiss options. It fits its content up to 8px below the notch and scrolls inside when taller, with no half-height stop, and content-sized drawers no longer open below the screen.
- **Core:** `shellui start` no longer serves cached shell scripts and styles from the dev service worker, so an upgrade shows the new shell on the first load. Dev caches are named after the core version and older ones are removed.

## [0.7.0-alpha.10] - 2026-10-27

### ✨ Feature

- **Core:** Floating layout: a More bottom sheet on phones, and the dock steps aside while the soft keyboard is open.
- **Core:** Windows layout: a slow dot field on the desktop that pauses when hidden or covered and stays static under reduced motion.

### 🛠 Improvements

- **Core:** Shell chrome tokens for radius, motion, glass, nav states and the desktop, in light and dark.
- **Core:** `applyTheme` flags low contrast nav colors with `data-shellui-nav-contrast="low"` and tints the active pill.
- **Core:** Accessible navigation in every layout: named landmarks, `aria-current`, announced external links and translated labels (en, fr).

### 🚨 Changed

- **Core:** Sidebar and sidebar-inset layouts: a primary active pill, quieter group labels and theme card radius.
- **Core:** App bar and app-bar-inset layouts: a primary underline or raised pill for the active item and touch-size menu rows on phones.
- **Core:** Floating layout: lighter glass, a capsule behind the active dock icon and the primary pill in the sidebar.
- **Core:** Windows layout: card surface windows, glass taskbar and start menu, and a minute clock.
- **Core:** Fullscreen layout: Back and Forward sit in a glass group in the Tauri app.
- **Core:** macOS desktop: every layout draws a 32px strip around the system traffic lights, with an 80px drag-only safe area.
- **CLI:** macOS traffic lights stay at the AppKit default, so they move in existing template apps (close about 7px from the left edge, centered in the title bar).

### 🗑 Removed

- **CLI:** `trafficLightPosition`, `src/macos.rs` and the `objc2` crates from the Tauri template; `shellui` sync removes them from existing apps.

### 🏗 Chore

- Tauri desktop app `Cargo.toml` and `Cargo.lock` versions follow the release again (were 0.7.0-alpha.3).

## [0.7.0-alpha.9] - 2026-10-27

### 🚨 Changed

- **SDK:** `shellui.login` `redirectPath` now names the shell page to open after sign-in. It defaults to the page that called `login`.

### 🐛 Bug Fixes

- **Core:** `shellui.login` from an app returns through `/login/callback`, so people land back signed in instead of on the login page.
- **Core:** Logged-in only navigation entries stay visible while the session restores, so the sidebar no longer grows after a reload.

## [0.7.0-alpha.8] - 2026-10-24

### 🐛 Bug Fixes

- **SDK:** `ShelluiFrame` loads `src` once. New service URLs re-register without reloading, and a retry reloads where the child was.
- **SDK:** `ShelluiFrame` and `ContentView` skip echoes of child navigation, so fast redirects no longer bounce or loop.
- **SDK:** `SHELLUI_URL_CHANGED` carries `replace`, so a child redirect replaces the host entry instead of adding one.

## [0.7.0-alpha.7] - 2026-10-24

### ✨ Feature

- **SDK:** `ShelluiFrame` and `createAppFrame` accept a `files` URL, sent to the child as `settings.storage.filesUrl`.

## [0.7.0-alpha.6] - 2026-10-24

### ✨ Feature

- **SDK:** `ShelluiFrame` and `createAppFrame` accept `email`, `storage` and `hosting` URLs for the child app.
- **Core:** The shell forwards child service URLs allowed by `childFrames.serviceOrigins`, others are `null`.

### 🚨 Changed

- **Core:** No built-in email URL: `email` without `url` now sends `settings.email: null`.

### 📚 Documentation

- **Core:** `AppBackendConfig.provider` documents `upstream` token exchange.

## [0.7.0-alpha.5] - 2026-10-23

### ✨ Feature

- **Core:** Regional app sessions use OAuth token exchange (RFC 8693) instead of iframe silent sign-in.
- **Core:** Regional sessions renew with their own refresh token first.
- **SDK:** App frames report why the child has no session (`onSession`, `renderError`).

### 🐛 Bug Fixes

- **SDK:** Child navigation no longer reloads the app frame.

## [0.7.0-alpha.4] - 2026-10-23

### ✨ Feature

- **SDK:** App frame (`createAppFrame`, `<ShelluiFrame>`) with a loading overlay embeds a child app with its own regional session.
- **SDK:** `useShelluiNavigation` helper in `@shellui/sdk/react` syncs app routes with the shell.
- **Core:** Regional silent sign-in uses the identity federation entry `/oauth/silent-signin`.

### 🐛 Bug Fixes

- **Core:** Deep links keep their query string when the shell opens an app.

## [0.7.0-alpha.3] - 2026-10-23

### 🐛 Bug Fixes

- **Login:** A new tab no longer looks signed in without a token, so embedded apps no longer show a dead sign-in screen. It shows the sign-in page instead.

## [0.7.0-alpha.2] - 2026-10-21

### 🐛 Bug Fixes

- **Login:** Sign-in works on static hosts that add a trailing slash to `/login/callback`, such as GitHub Pages.

## [0.7.0-alpha.1] - 2026-10-21

### ✨ Feature

- **SaaS:** First alpha of 0.7.0, preparing the global console, saas-service and multi-region federation. Requires identity-service 0.9.0.
- **App identity server:** A navigation item can set `backend` when that embedded app uses a different identity server. The shell keeps a separate session and sends that app its own URL and access token.
- **App services:** A navigation item can set `email`, `storage`, and `hosting` for that app. When `backend` names another server and a service is omitted, the app receives no URL for it.

### 🐛 Bug Fixes

- **Desktop:** Switching pages in the desktop app loads the new page instead of keeping the old one.
- **Login:** The Cancel button is hidden when the app has no page available without signing in.
- **Login:** The page next to the sign-in form follows dark and light mode changes.

### 🔒 Security

- **Dependencies:** Patched `proxy-addr`, `compression` and `source-map-js` to clear the open Dependabot alerts.
- **Login:** Web sign-in uses PKCE, required by identity-service 0.9.0.
- **CLI:** `shellui login` uses PKCE.
- **Docs site:** The docs build has read-only access, and a separate job publishes Pages.
- **SDK messages:** Companion code posts to the parent only once its origin is known.
- **CLI credentials:** Tokens go to the OS keychain, or a `0600` file with a warning.
- **Workflows:** Actions are pinned to commit SHAs, and tests run with `contents: read`.

## [0.6.2] - 2026-10-18

### 🐛 Bug Fixes

- **Desktop sign-in:** Works in `shellui start --app` with a separate `<scheme>-dev` scheme (needs identity-service with `-dev` support).
- **Desktop sign-in:** Signing in from the login modal or drawer closes it and completes in the shell.
- **Desktop sign-in:** The app window comes to the front when the sign-in link arrives.
- **Settings modal:** Settings opened as a modal or drawer gets the access token, so Storage works there.
- **Desktop chrome:** Action buttons and the dock stay clear of the macOS traffic lights.

### 🛠 Improvements

- **Desktop window:** macOS layouts leave room for the traffic lights, and empty chrome drags the window.

## [0.6.1] - 2026-10-13

### 🐛 Bug Fixes

- **Deep links:** Opening or refreshing a nested route loads shell JavaScript and CSS from the site root.
- **Embedded session:** When the shell tab is shown again, it refreshes an access token that expired in the background and sends the session to iframe apps again. An app that asks while the token is expired gets a new one. The SDK keeps the last access token if a settings message drops it, and asks the shell for a replacement.

### 🛠 Improvements

- **Deploy:** `shellui deploy` warns when a preview origin was not added to allowed redirects, and the deploy still succeeds.

### ✨ Feature

- **Desktop sign-in:** A Tauri shell signs in through the system browser with Proof Key for Code Exchange (PKCE) when `auth.desktopScheme` is set. Browser sign-in stays the same.

### 📚 Documentation

- **Desktop sign-in:** The desktop page lists the scheme, the Tauri deep-link plugin, and `configureDesktopAuth`.

## [0.6.0] - 2026-10-07

### ✨ Feature

- **Account management:** Edit your name and delete your account from Settings, under user account, on the Shellui identity backend.
- **Magic link login:** The login page uses a magic link when no method is set, shows "Check your email", and waits 60 seconds before another send.
- **Email service:** Optional `email.url` and `email.showInAdmin` in `shellui.config` are exposed to apps as `settings.email`.

### 🛠 Improvements

- **Transfers:** Uploads and model downloads share one progress toaster, and downloads continue after you leave Settings.
- **Settings:** The AI panel collapses when apps are not allowed to use AI, and Storage shows on-device model usage.

### 🚨 Changed

- **Iframe handshake (breaking):** Call `init` from `@shellui/sdk` first, because the shell sends settings only after that request and only to frames that are ready.
- **On-device AI:** AI stays off unless `ai.enabled` is `true`, and the docs nav has no AI section.

### 📚 Documentation

- **Agent guidelines:** Root `AGENTS.md` links the Shellui writing and design guidelines.

### 🐛 Bug Fixes

- **Session restore:** Reloading keeps you signed in during local development, and the shell shows a loading state while the session restores.
- **Toasts:** Bottom toast lists no longer block clicks on the page behind them.
- **Staff magic links:** A staff account that opens an old email link sees "Sign in with your usual sign-in method instead."

## [0.5.3] - 2026-09-20

### 🐛 Bug Fixes

- **Localhost iframe white screen:** embedded companions now auto-trust the parent shell origin (same as tiny), so cross-origin dev (`:4000` ↔ `:5173`) accepts `SHELLUI_SETTINGS` and `await shellui.init()` completes. Proactive `SHELLUI_LAYOUT_CHROME` posts no longer race `about:blank`.

## [0.5.2] - 2026-09-18

### 🐛 Bug Fixes

- **OAuth callback / deep shell routes on static hosts:** `shellui build` now materializes nested `dist/web/<path>/index.html` for built-in shell routes (`/login`, `/login/callback`, settings, legal, …) in addition to navigation paths, with `rewriteRelativeAssetDepth` so `./assets/…` resolves correctly on GitHub Pages and similar hosts. Without this, `/login/callback` fell through to root `404.html` and loaded assets from `/login/assets/…` → white page.

## [0.5.1] - 2026-09-18

### 🛠 Improvements

- **identity-service 0.5.0 auth:** shell and CLI complete OAuth via one-time `shellui_auth_code` → `POST /api/v1/oauth/session` (default delivery). Legacy URL-fragment bounce and provider `?code=` exchange remain supported during rollout. Token refresh persists rotated refresh tokens; logout sends refresh for server-side revocation when available.

### 🔒 Security

- **Auth token storage (H-09 / M-17):** split persisted session — profile metadata in `localStorage`, refresh token in tab-scoped `sessionStorage`, access token memory-only. Legacy `shellui.auth.session` auto-migrates.
- **Optional BFF auth:** `security.bffAuth.enabled` routes `/api/auth/{session,refresh,logout}` through the shell host with HttpOnly refresh cookies (CLI dev + `serve:dist`). Identity-native cookie OAuth remains a documented follow-up.
- **Shell CSP:** report-only by default with SHA-256 hash for the inline theme bootstrap; opt into enforcing via `security.csp.enforce`. See [Security hardening](./docs/features/security.md).
- **Modal iframe allowlist:** localhost origins are allowed only in development builds; production shells reject loopback modal URLs unless they match configured storage, admin, or same-origin targets. (#63)
- **Navigation route guard:** routes with `requiresStaff` now show an access-forbidden view for signed-out and non-staff users (client-side UX guard; APIs must still enforce authorization). (#63)
- **Login branding `panelUrl`:** restricted to same-origin relative paths, configured backend/login/storage origins, and loopback URLs in development only. Untrusted absolute URLs are ignored. (#63)
- **`safeForAuthToken` default is now opt-in (breaking):** companion iframe apps no longer receive `settings.accessToken` unless their navigation item sets `safeForAuthToken: true`. First-party admin and storage file explorer frames are unchanged. The refresh token was never shared with companions and still is not. See [Authentication — Iframe apps](./docs/features/authentication.md#iframe-apps) for migration.
- **StorageBridge trusted-frame gate (H-07):** `SHELLUI_STORAGE_REQUEST` is honored only from registered iframe companions that pass the same trusted-frame policy as session JWT sharing (`safeForAuthToken: true` opt-in, admin URLs, `storage.filesUrl`). Untrusted senders receive `403` without storage I/O. Shared helpers live in `features/security/trustedFrames`.
- **postMessage hardening (H-06 / M-13 / M-14):** inbound `SHELLUI_*` messages now require an allowed origin and a trusted source (registered iframe, parent shell, or same-window). Privileged companion commands (`SHELLUI_LOGIN` / `LOGOUT`, modal/drawer, toast/dialog, chrome actions, etc.) reject unregistered frames. Outbound SDK and shell replies use concrete target origins instead of `'*'`. The Shellui host auto-derives companion origins from `shellui.config.json` navigation and storage URLs, plus optional `security.allowedMessageOrigins` for manual extras (preview/staging hosts, etc.). Standalone SDK embeds can still use `shellui.configureMessageSecurity({ allowedOrigins: [...] })` or `shellui.init({ allowedMessageOrigins: [...] })`.
- **Track F (#65) — companion isolation + CLI hardening (M-18, L-10..L-14):**
  - **M-18:** Tighten content iframe sandbox (drop `allow-popups-to-escape-sandbox`); document distinct-origin dev companions and production same-origin plan ([companion isolation](./docs/features/companion-isolation.md)).
  - **L-10:** Document CLI credential plaintext-at-rest residual (`0600`/`0700` permissions); OS keychain follow-up noted.
  - **L-11:** Loopback `/capture` requires one-time session nonce (`X-Shellui-Login-Nonce` + JSON `nonce`); OAuth `state` bound to the same nonce.
  - **L-12:** Loopback login pages and terminal output show port/nonce and anti-phishing guidance.
  - **L-13:** Trusted config path checks — warn on out-of-tree config, reject world-writable / symlink-escaped paths; document TS execution threat model.
  - **L-14:** Validate `dev.url` / `--follow` (loopback default, warn on remote, reject metadata/link-local); new `--allow-remote-companion` flag.

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
