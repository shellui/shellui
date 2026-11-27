# Change log

Notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [Semantic Versioning](https://semver.org/).

<!---
## [x.y.z] - yyyy-mm-dd

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

## [Unreleased]

### ✨ Feature

- Shellui Marketplace runtime (early, opt-in with `marketplace` in `shellui.config.json`). The shell merges a per-user navigation overlay (`localStorage`, or Identity `/api/v1/navigation-overlay`) with the static navigation. Settings has a **Navigation** page to reorder, hide, uninstall and revoke capabilities. `shellui add <app-id>` appends a catalog app to the config.
- Every runtime install is treated as third-party. One shared validator and JSON Schema (`packages/sdk/schemas/navigation-overlay.v1.json`) cover installs, `localStorage` and Identity layouts. Core paths are reserved. Third-party frames receive appearance, language, region and layout only, and their inbound messages use an allowlist.
- The installed-app registry and the message policy are written when the layout is saved or loaded, not during render. A component test renders the real `NavigationProvider` (revoke, StrictMode, install lock, transitions).
- Frames on an installed origin get the third-party settings by origin, hosts with a trailing dot are refused, and a layout save that conflicts with another device is shown to the person. Unsaved revokes, uninstalls and resets stay in force and are applied to the newer layout and to any edit made meanwhile until a save includes them, and only what this device removed is taken out. After a conflict the newer layout is read from Identity only. The person is told when a change was not saved, including when Identity is down and only the device copy was written; those removals stay in force too. Unsaved removals are kept per user and company in `sessionStorage`, so a reload does not undo them and another account never gets them. Settings says when such a change is not saved yet. A successful reset clears them all. The layout version (`ETag`) is taken only from a successful response and adopted only when the layout read at it is committed; a stale read adopts nothing. Changes are refused, and Navigation settings disabled, until the saved layout has loaded. Reset asks for confirmation and says it applies on every device. The marketplace is always off in the desktop (Tauri) app, at build time and at runtime. `shellui add` treats only `admin`, `dashboard`, and `files` on `shellui.com` as official.

### 📚 Documentation

- Installation, quickstart, Tauri and README now give the Node.js version the CLI needs: 22.12 or later. The root `engines` field matches.

### 🔒 Security

- Core i18next 27 and react-i18next 18 (fixes GHSA-6jcc-5g8w-32mx, a DoS in `deepExtend`).

### 🚨 Changed

- cac 7 (CLI argument parser) now errors on extra positional arguments, for example `shellui build ./app extra`. Remove stray arguments from scripts that call the CLI.
- Sentry reporting no longer sends default personal data. The shell sets `dataCollection` explicitly with user info, cookies, headers, bodies and query strings off (Sentry 11 replaced `sendDefaultPii`).
- Node.js 22.12 is now the minimum for the CLI. Node 20 is EOL, and i18next 27 and react-i18next 18 need Node 22 or later.

### 🐛 Bug Fixes

- `shellui login --no-browser` now skips opening the browser. The option was read under the wrong name.
- The CLI auth BFF answers a malformed refresh cookie with `401` and clears it, instead of a `500`.
- `POST /api/auth/logout` with a malformed refresh cookie now returns `204` and still clears the cookie.
- The inline theme script hash in the production CSP now matches the script served in `index.html` (it was computed over slightly different text).

### 🏗 Chore

- The CLI `engines` field is `node: ">=22.12.0"`.
- Dependencies: Vite 8 (Rolldown and Oxc), cac 7, @sentry/react 11, React 19.3, opentype.js 2 and minor updates. The shell now pins its TypeScript settings with Vite's `tsconfig` option (`packages/cli/src/utils/shell-tsconfig.json`), so a consumer `tsconfig.json` still never applies. CSS minification uses Vite's default Lightning CSS.
- Docker image, dev compose and CI run on Node.js 26 (current LTS). CLI tests also run on Node.js 22.12, the supported minimum.
- CI type-checks `@shellui/core` and fails on any error not in `packages/core/typecheck-baseline.json` (66 existing errors, keyed by file, code and message). The check also fails when the total drops, so the baseline is lowered.
- CLI uses @vitejs/plugin-react 5.2 (Vite 8 peer range). Added a regression test that the shell ignores a consumer `tsconfig.json`.

## [0.8.6] - 2026-11-25

### 🐛 Bug Fixes

- Dashboard Settings, MCP / agents, lists global MCP connections from ai-service (`GET /ai/v1/mcp/global/agents`) when the session is a Shellui account, and revokes them with `POST /ai/v1/mcp/global/agents/{id}/revoke`. An approved global device grant no longer disappears behind "No active connections," which only listed regional identity personal agents.

## [0.8.5] - 2026-11-25

### 🐛 Bug Fixes

- Allow `ShelluiFrame` (`@shellui/sdk`) and `childFrameAuthPropagationOptions` (`@shellui/core`) to pass a per-frame `aiService` origin override (allowlisted through `childFrames.serviceOrigins`) so embedded regional admin frames receive the company's regional AI service URL instead of falling back to the global AI service.

## [0.8.4] - 2026-11-25

### 🐛 Bug Fixes

- Keep `allow-same-origin` in the `ContentView` iframe sandbox for valid `http(s)` and custom desktop shell URLs (including same-origin `/app/` companions and nested hash routes). Omitting `allow-same-origin` gave those frames an opaque origin (`Origin: null`), breaking Vite module script and stylesheet CORS fetches, SDK `postMessage` origin verification, and nested admin frame detection. Unparseable, empty, and non-`http(s)` URLs still omit `allow-same-origin`. (#230)

## [0.8.3] - 2026-11-24

### 🐛 Bug Fixes

- Settings shows the Shellui account MCP URL (`/mcp`) when `aiService.mcpUrl` is set, so dashboard settings no longer use the regional `/c/{companyId}/mcp` URL. A regional project that omits that field still shows the company URL. (#227)

### ✨ Feature

- The local dev stack includes Jaeger all-in-one for traces. (#225)

## [0.8.2] - 2026-11-22

### 🚨 Changed

- Companion URLs on the shell origin, including the production `/app/` path, now load without `allow-same-origin` by default. Host companions on their own origin and set `SHELLUI_APP_URL` or the navigation `url` to that absolute URL when they need cookies, storage, or the settings handshake. Cross-origin companions, including local dev, are unchanged. (#216)

### 🔒 Security

- The shell applies `SHELLUI_SETTINGS` and `SHELLUI_SETTINGS_UPDATED` only from the shell window or a shell page (settings, cookie preferences, login, and other shell routes). A companion frame cannot change shell settings. (#216)
- The SDK and the tiny embed apply `SHELLUI_SETTINGS` and `SHELLUI_SETTINGS_UPDATED` only when the sender is `window.parent` and the parent origin is known. If that origin is unknown, those messages are ignored. (#216)

### 🏗 Chore

- Publish `@shellui/sdk`, `@shellui/core`, and `@shellui/cli` from GitHub releases using npm trusted publishing with provenance. (#217)
- Update minor/patch npm dependencies, GitHub Action pins (`pnpm/action-setup` 6.1.1), `lint-staged` 17, and `vitest` 5. (#218)

## [0.8.1] - 2026-11-18

### ✨ Feature

- The local dev stack runs a regional ai-service and a global ai-service. (#211)

### 🚨 Changed

- In the local dev stack, a Shellui account MCP uses the global ai-service. Regional identity trusts that issuer and still accepts the saas issuer. (#211)

### 🐛 Bug Fixes

- **Core:** The Files app in a project admin uses that project's storage URL and regional session. (#201)

## [0.8.0] - 2026-11-18

Shellui 0.8.0 adds MCP agents, approvals, and activity in Settings, plus OAuth device login. You can sign in to the CLI with a device code and inspect your company. The shell stores its refresh token in an HttpOnly host cookie.

### ✨ Feature

- Settings shows MCP agents, approvals, and activity when an AI service URL is set.
- Connect MCP agents with OAuth device login.
- Personal MCP agents connect from Settings, and Settings reports success or failure.
- Settings activity lists MCP tool calls from ai-service.
- The CLI can sign in with OAuth device authorization.
- The CLI can inspect dashboard, storage, and hosting for the signed-in company.
- The SDK forwards the ai-service URL to apps.

### 📚 Documentation

- Docs cover MCP tool discovery and an updated AI native guide.
- Security and authentication docs explain the host refresh cookie.
- An Open source or Cloud page is in the docs.
- The docs site generates social preview cards.
- Docs recommend the local dev stack for running Shellui.
- The companion isolation page is ready to share.

### 🐛 Bug Fixes

- The Settings MCP nav stays in place after sign-in, including while status loads.
- Dev-stack sign-in stays valid across browser tabs.
- Sign-in PKCE works on plain HTTP when the browser has no SubtleCrypto.
- CLI project commands call the SaaS `/api/v1` company routes.

### 🔒 Security

- `shellui start` and `serve:dist` keep the shell refresh token in an HttpOnly host cookie. Page JavaScript receives only the access token. A static host without those routes keeps the previous sessionStorage refresh token.
- MCP connection expiry stays within Identity's 90-day limit.
- Signing out of the shell also clears the identity browser session.

### 🏗 Chore

- Local Docker dev stack under `dev/` for the shell, sibling services, and front-end hot reload.
- The dev stack runs global and regional identity, seeds local users, and creates missing databases on start.
- `./start.sh` generates dev signing keys, forwards SaaS approvals to identity, and stops the stack cleanly.
- Dev front ends hot-reload Shellui packages, load one Vite config, and use less idle CPU.
- The dev stack publishes MCP resource URLs for storage, hosting, and SaaS.
- The local admin links to Mailpit, the stack includes the playground, and the dev image skips unneeded files.

## [0.7.0] - 2026-10-31

Shellui 0.7.0 brings multi-region federation: each embedded app can use its own identity server and services, with regional sessions and a new SDK app frame. It also redesigns every layout for phones and accessibility, adds token-based CI previews to the CLI and hardens sign-in with PKCE.

### ✨ Feature

- **Core:** Per-app identity servers: a navigation item can set `backend`, and the shell keeps a separate regional session for that app. Requires identity-service 0.9.0.
- **Core:** Per-app `email`, `storage` and `hosting` URLs, forwarded to child apps when allowed by `childFrames.serviceOrigins`.
- **Core:** Regional sessions use OAuth token exchange (RFC 8693) and renew with their own refresh token.
- **SDK:** App frame (`ShelluiFrame`, `createAppFrame`) embeds a child app with its own session, service URLs, a loading overlay and session error reporting.
- **SDK:** `useShelluiNavigation` in `@shellui/sdk/react` keeps app routes in sync with the shell.
- **CLI:** `SHELLUI_DEPLOY_TOKEN` creates and updates 7-day previews from CI without a login. The token is never printed.

### 🛠 Improvements

- **Core:** Redesigned sidebar, app bar, floating, windows and fullscreen layouts, with shared theme tokens in light and dark.
- **Core:** Phone support in every layout: bottom sheets, a More sheet, safe areas and a dock that steps aside for the keyboard.
- **Core:** Accessible navigation: named landmarks, `aria-current`, announced external links and translated labels (en, fr).
- **Core:** Account block with picture or initials, name and email in the sidebar and windows start menu.
- **Core:** `applyTheme` flags low contrast nav colors.
- **CLI:** `shellui deploy` saves a new preview slug to `shellui.config.json`.
- **CLI:** Credentials are stored per account. `shellui logout --all` clears every account.
- **Packages:** Fuller npm descriptions, keywords and links for `@shellui/core`, `@shellui/sdk` and `@shellui/cli`.

### 🚨 Changed

- **SDK:** `shellui.login` `redirectPath` names the shell page to open after sign-in, and defaults to the calling page.
- **Core:** `email` without `url` sends `settings.email: null`. There is no built-in email URL.
- **Core:** Drawers float above the page, and phone drawers, modals and sheets share one bottom sheet style.
- **Desktop:** macOS traffic lights stay at the system default, inside a 32px strip in every layout.

### 📚 Documentation

- **Docs:** Token exchange (`AppBackendConfig.provider`) and CLI credential storage.
- **Docs:** docs.shellui.com serves `robots.txt` and `llms.txt`.

### 🗑 Removed

- **CLI:** `trafficLightPosition`, `src/macos.rs` and the `objc2` crates from the Tauri template. `shellui` sync removes them from existing apps.

### 🐛 Bug Fixes

- **Login:** Sign-in works on static hosts that add a trailing slash, such as GitHub Pages, and apps return signed in after `shellui.login`.
- **Login:** New tabs no longer look signed in without a token, and the sign-in page follows dark and light mode.
- **Core:** Deep links keep their query string, and logged-in only navigation stays visible while the session restores.
- **SDK:** `ShelluiFrame` no longer reloads, loops or adds history entries on child navigation.
- **Core:** Phone drawers fit their content and no longer open below the screen.
- **CLI:** `shellui start` shows the new shell right after an upgrade instead of cached files.
- **CLI:** `shellui deploy` errors show the server's reason, and a rejected upload shows the artifact size and limit.
- **Desktop:** Switching pages loads the new page.

### 🔒 Security

- **Login:** Web sign-in and `shellui login` use PKCE.
- **CLI:** Tokens are stored in the OS keychain, or a `0600` file with a warning.
- **SDK:** Companion code posts to the parent only once its origin is known.
- **Workflows:** Actions are pinned to commit SHAs with read-only permissions.
- **Dependencies:** Cleared all critical and high audit alerts with patched versions and overrides.

### 🏗 Chore

- **Desktop:** Tauri 2.10 to match `@tauri-apps/api`, and app versions follow the release.

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
