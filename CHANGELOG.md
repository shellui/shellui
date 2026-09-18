# Change log

Notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

### ✨ Feature

- **WebLLM browser engine:** Settings → AI **Install** fetches curated MLC/WebLLM catalog weights via `@mlc-ai/web-llm` (Hugging Face URLs from WebLLM’s prebuilt library), runs inference in a dedicated Web Worker, and marks models ready for `shellui.ai.languageModel` prompt/streaming immediately after install. Refs #47.
- **Config AI kill-switch:** `shellui.config` `"ai": { "enabled": false }` (default **true**) hides Settings → AI, skips the full AiBridge, answers SDK AI with `unavailable` / `ai_disabled`, and never loads the WebLLM chunk/worker. Distinct from Settings → AI “Allow apps to use AI”.

### 🛠 Improvements

- **Shared transfer toaster:** storage uploads and AI model downloads share `TransferToaster` / `transferQueue` progress UI (accurate engine progress; downloads continue after leaving Settings).
- **Lazy WebLLM:** `@mlc-ai/web-llm` is dynamically imported only on first browser Install/load; opening Settings → AI alone does not fetch the library. `AiBridge` itself is lazy-loaded when config AI is enabled.
- **Experimental (not blocked) browser Install:** Chrome/Edge/**Safari** are recommended; **Firefox** shows a **warning banner** but Install is still **allowed**. Failures surface the real mapped `[shellui.ai]` error instead of a pre-emptive block. Richer console errors + CSP extras (Ollama localhost, HF, worker-src, wasm-unsafe-eval) when AI is enabled; Vite resolves/prebundles `@mlc-ai/web-llm` for the shell.
- **Reliable WebLLM conversation switch:** the engine tracks the owning LanguageModel session and, on switch, eagerly `interruptGenerate()`s then **reloads the same model** (clears KV/chat, weights stay cached) — fixing “new chat stuck on Thinking…” that `resetChat` alone did not. Ollama is unaffected (stateless HTTP).
- **Diagnosable WebLLM Install failures:** Worker `error` / `messageerror` and `CreateWebWorkerMLCEngine` rejections (including WebLLM’s string throws) are logged as `console.error('[shellui.ai]', …)` and shown in the transfer toaster / Settings error — with an explicit **WebGPU failed in the WebLLM worker** mapping when applicable. HF traffic is expected under the **Worker** Network tab, not the main document.
- **Sequential WebLLM prompts:** `prompt` / `promptStreaming` are serialized on the shared worker; streams are fully drained and `interruptGenerate()` runs after each turn so a second Chat question does not hang. `AiSession` accumulates message history for multi-turn context.
- **WebLLM conversation switch:** LanguageModel `destroy` / `create` call `resetChat` (under the generation lock) so a new playground chat does not hang on stale worker KV state — weights stay warm. Late `destroy` of a superseded session skips `resetConversation` / `interruptGenerate` (activeSessionId guard) so it cannot kill the new chat’s in-flight generation. SDK `destroy()` is awaitable.
- **WebLLM Vite interop:** **exclude** `@mlc-ai/web-llm` from `optimizeDeps` (esbuild prebundle mangles named exports); keep package alias + `loglevel` include. Normalize dynamic import (`.default` / nested / `CreateMLCEngine` fallback). After pull: `rm -rf node_modules/.vite-shellui`.

### 📚 Documentation

- Update on-device AI docs for the real WebLLM install / worker / toaster path and config vs Settings disable.

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
