---
title: Core package
sidebar_label: Core
description: '@shellui/core is the React shell runtime the CLI serves. Import config types and useAuth when you extend the host.'
---

`@shellui/core` is the React application the CLI starts and builds. You do not install it for a normal `shellui init` project - the CLI depends on it. Import it when you type `shellui.config.ts`, call `useAuth` / `useCookieConsent` from host code, or embed the runtime yourself.

## Install

```bash
npm install @shellui/core
```

Peer dependencies: React 18 or 19. The package also depends on `@shellui/sdk`.

## Config types

```typescript
import type { ShellUIConfig, NavigationItem } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'My Shellui App',
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: 'http://localhost:4000/',
      icon: '/icons/home.svg',
    },
  ],
};

export default config;
```

`ShellUIConfig` includes `port`, `title`, `version`, `favicon`, `appIcon`, `logo`, `language`, `layout`, `start_url`, `navigation`, `administration`, `storage`, `hosting`, theme fields, `sentry`, `backend`, `cookieConsent`, `legalDocuments`, `security` (e.g. `allowedMessageOrigins` for postMessage allowlist extras), and CLI-only `dev`. Item-level fields such as `requiresAuth` and `openIn` live on `NavigationItem`. Prefer the JSON schema at `@shellui/core/schemas/shellui.config.schema.json` over copying a partial interface into docs.

Subpath exports:

- `@shellui/core` - `App`, types, `useAuth`, `useConfig`, cookie-consent helpers, theme helpers
- `@shellui/core/types` - config types only
- `@shellui/core/constants/urls` - built-in routes (`/login`, `/__settings`, `/legal`, …)
- `@shellui/core/theme` - theme utilities
- `@shellui/core/style.css` - shell CSS

## Auth in host code

`useAuth` must run under `AuthProvider` (the CLI shell already wraps the app):

```typescript
import { useAuth } from "@shellui/core";

function AccountSummary() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <p>Not signed in</p>;

  return (
    <div>
      <p>{user?.email}</p>
      <button type="button" onClick={() => void logout()}>
        Sign out
      </button>
    </div>
  );
}
```

`AuthUser` includes `id`, `email`, `name`, `profilePicture`, `isStaff`, `isCompanyOwner`, `authProvider`, and `groups`. Session tokens stay on `AuthSession`. Iframe apps should read the signed-in profile from SDK settings instead of importing core.

Cookie helpers: `useCookieConsent(host)`, `getCookieConsentAccepted(host)`. See [Cookie consent](/features/cookie-consent).

`useSettings` is **not** a public export. Iframe apps read `settings` from SDK messages. Layout override at runtime is **Settings → Develop → Layout** when developer features are enabled.

## Themes

Named curated themes and helpers (`defaultTheme`, `themes`, `themeNames`, `shelluiTheme`, `applyTheme`, …) export from `@shellui/core`. JSON sources live under `packages/core/src/features/theme/curated/` and validate against `schemas/shellui.theme.schema.json`. See [Themes](/features/themes).

## Build this package

From the monorepo:

```bash
cd packages/core
pnpm run build
```

That regenerates the config schema and curated-theme catalog. Day-to-day host development uses `shellui start` from the [CLI](/cli).
