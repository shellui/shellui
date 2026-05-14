# ShellUI Documentation

Welcome to the ShellUI documentation.

ShellUI is a lightweight microfrontend shell: one host app, many embedded URLs, shared navigation, themes, and settings. When you need sign-in, you connect a **backend** (Supabase, the ShellUI identity service, or no backend for public shells) and configure **authentication** in `shellui.config.ts`—login routes, sessions, and guarded navigation are built into the shell.

Use the sections below as a map, or follow the recommended path in order.

## Recommended path

1. **[Installation](/installation)** — Install the ShellUI CLI and verify your environment.
2. **[Quick Start](/quickstart)** — Create `shellui.config.ts`, run the dev server, and build for production.
3. **[Backend](/backend)** — Choose a provider (`shellui`, `supabase`, or none), set `backend.url`, and optional tenant or Supabase keys.
4. **[Authentication](/features/authentication)** — Enable login methods, use `/login` and `/login/callback`, and protect routes with `requiresAuth`.
5. **[Navigation](/features/navigation)** — Define sidebar items, groups, and auth-aware visibility (`hideWhenLoggedOut`).
6. **[SDK](/sdk)** — Read user and settings from embedded apps; call `shellui.login()` for iframe-safe OAuth.

From there, pick layout, themes, i18n, and advanced features as your product needs them.

## Core features

### Navigation and layout

- **[Navigation](/features/navigation)** — Icons, groups, localization, opening modes, and route protection
- **[Layouts](/features/layouts)** — Sidebar, fullscreen, Windows desktop (experimental), or app bar
- **[Modals and drawers](/features/modals-drawers)** — Overlays and side panels for nav targets

### Customization

- **[Themes](/features/themes)** — Light and dark modes, fonts, and colors
- **[Internationalization](/features/internationalization)** — Localized navigation and UI

### User interface

- **[Toast notifications](/features/toasts)** — Toasts with actions and styles
- **[Alert dialogs](/features/dialogs)** — Confirm and alert patterns

### Advanced

- **[Application settings](/features/application-settings)** — Per-app settings panels in Settings
- **[Cookie consent](/features/cookie-consent)** — Cookie registry and consent storage
- **[Legal documents](/features/legal-documents)** — Privacy, terms, and notices from markdown (including on the login page)
- **[Service worker](/features/service-worker)** — Offline support and update prompts
- **[SDK integration](/sdk)** — Programmatic shell APIs for embedded apps

## Reference

- **[CLI](/cli)** — Commands, config file shape, and `backend` fields
- **[Core package](/core)** — React runtime and exports such as `useAuth`
- **[SDK](/sdk)** — JavaScript SDK API
- **[Tauri](/tauri)** — Desktop packaging

## Developer resources

- [Development guide](/development) — Contributing to ShellUI
- [Publishing guide](/publishing) — Releasing packages
