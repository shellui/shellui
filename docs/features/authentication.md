# Authentication

This guide follows [Backend](/backend) in the getting-started path. It covers sign-in configuration, built-in login routes, and navigation guards for developers hosting their own shell.

ShellUI authentication is **configuration-driven**: set `backend` in `shellui.config.ts`, declare login capabilities, protect navigation items, and use built-in routes at `/login` and `/login/callback`. The shell stores the session, refreshes tokens, and shares the signed-in user with embedded apps through the SDK.

## Prerequisites

Configure a backend provider first. See [Backend](/backend) for ShellUI identity service vs Supabase and field reference.

## Enable authentication

Add a `backend` block to `shellui.config.ts` (or `shellui.config.json`). Without it, `useAuth()` reports signed out and login actions are unavailable.

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'My App',
  backend: {
    type: 'shellui',
    url: 'http://localhost:8000',
    companyId: 1,
    login: {
      methods: ['oauth', 'magic_link'],
      oauthProviders: ['github', 'google'],
    },
  },
};

export default config;
```

### Login methods

`backend.login.methods` lists what the **login page is allowed to show**. At runtime ShellUI intersects this list with settings from the backend so misconfigured providers are not offered.

| Method       | Login UI         | Notes                                                                                          |
| ------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| `oauth`      | Provider buttons | Requires `oauthProviders` and provider enabled on the backend.                                 |
| `magic_link` | Email field      | Supabase email auth; ShellUI identity when the backend advertises it.                          |
| `web3`       | Ethereum wallet  | Supabase external provider / ShellUI Web3 when enabled.                                        |
| `password`   | —                | Recognized in types and backend payloads; password UI is not rendered by the stock login view. |

`backend.login.oauthProviders` is an array of provider ids (for example `github`, `google`, `microsoft`, `apple`). ShellUI deduplicates and lowercases them. For ShellUI auth, per-company OAuth clients from `/api/v1/settings` appear as separate buttons with labels.

### Provider-specific fields

**ShellUI (`type: 'shellui'`)**

- `url` — identity service origin.
- `companyId` — required for OAuth code exchange.
- `adminPathname` / `adminUrl` — optional staff admin iframe; staff users see **Administration** in the account menu when `adminPathname` is set.

**Supabase (`type: 'supabase'`)**

- `url` — project URL (hosted or `http://localhost:54321`).
- `publishableKey` — required for refresh and user metadata calls.

## Login page and routes

ShellUI registers fixed auth routes (see `urls` in `@shellui/core`):

| Path              | Purpose                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `/login`          | Login view: OAuth, magic link, Web3, legal links, `next` redirect handling |
| `/login/callback` | OAuth callback handler (authorization code exchange)                       |

You do **not** implement these pages in your microfrontends. They are part of the shell router.

### `next` query parameter

Protected routes redirect to `/login?next=<encoded-path>`. After a successful sign-in, ShellUI navigates to `next` (normalized to an in-app path). Example: `/billing` → `/login?next=%2Fbilling`.

### Optional login navigation item

The shell always exposes `/login`. You can add a navigation entry so users open login in the main area, a modal, or a drawer:

```typescript
import urls from '@shellui/core/constants/urls';

const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Login',
      path: 'login',
      url: urls.login,
      openIn: 'modal',
      position: 'end',
    },
  ],
};
```

When the user is authenticated, login entries whose URL matches the shell login route are **hidden** from the sidebar so you do not show “Login” while signed in. The header **account control** (avatar or “Login”) remains available in supported layouts.

### Account control

Layouts with a sidebar, app bar, or Windows taskbar render a login/account control: signed-out users go to `/login`; signed-in users get profile, settings, optional administration, and logout. Logout from a `requiresAuth` route navigates to `/` first so the user is not sent straight back to login.

## Guard navigation and routes

Navigation items support auth-aware visibility and enforcement (see [Navigation](/features/navigation)).

### `requiresAuth`

When `true`, direct navigation to the item’s path checks the session. While auth is loading, the route shows a fallback; when signed out, the shell redirects to `/login?next=...`.

```typescript
{
  label: 'Billing',
  path: 'billing',
  url: 'https://app.example.com/billing',
  requiresAuth: true,
}
```

Enforcement is implemented in the shell route wrapper (`NavigationItemRoute`): unauthenticated users never load the iframe URL until they sign in.

### `hideWhenLoggedOut`

When `true`, the item is omitted from the sidebar and 404 suggestions while signed out. The route may still exist; combine with `requiresAuth` to hide and protect.

```typescript
{
  label: 'Settings',
  path: 'settings',
  url: '/__settings',
  hideWhenLoggedOut: true,
  requiresAuth: true,
}
```

### Filter behavior

`filterNavigationForAuthState` removes `hideWhenLoggedOut` items when signed out and hides login nav URLs when signed in. Developer-only items (`requiresDevMode`) are unchanged by auth.

## Session and React API

`AuthProvider` wraps the shell app. In custom shell code (or apps that bundle core), use:

```typescript
import { useAuth } from '@shellui/core';

function Example() {
  const { user, isAuthenticated, isLoading, logout, startOAuth } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <p>Not signed in</p>;

  return (
    <div>
      <p>{user?.email}</p>
      <button type="button" onClick={() => logout()}>Sign out</button>
    </div>
  );
}
```

`AuthUser` includes `id`, `email`, `name`, `profilePicture`, `isStaff`, `isCompanyOwner` (ShellUI JWT), `authProvider`, and `groups`. `AuthSession` holds tokens and expiry for advanced use.

Sessions persist in browser storage; the shell refreshes access tokens before expiry and on a timer while the tab is open. OAuth returns may deliver tokens in the URL hash; the shell persists them and strips the hash.

## Embedded apps and the SDK

Iframes do not read storage directly. They receive user and `accessToken` through SDK settings after the shell initializes auth.

From a child app, request login in the **top-level** window (required for OAuth redirects):

```javascript
import { shellui } from '@shellui/sdk';

shellui.login({
  method: 'oauth',
  provider: 'github',
  redirectPath: '/login',
});
```

Supported `method` values: `oauth` (with `provider`), `web3`. The shell handles `SHELLUI_LOGIN` messages from nested frames.

Settings propagation includes `authBackendBaseUrl` when `backend.type` is `shellui`, so admin or API tools in iframes can call the same identity base URL.

## User settings

Signed-in users open **Settings** (built-in route) for account fields, theme, language, and region. ShellUI syncs preferences with the backend (`user_metadata` / ShellUI preferences endpoints) when configured.

Legal document links on the login page come from `legalDocuments` in config; see [Legal documents](/features/legal-documents).

## Checklist

1. Choose [Backend](/backend) provider and run it (identity service or Supabase).
2. Set `backend.type`, `url`, and provider-specific keys in `shellui.config.ts`.
3. Set `backend.login.methods` and `oauthProviders` to match what the backend enables.
4. Mark sensitive nav items with `requiresAuth` and optionally `hideWhenLoggedOut`.
5. Test deep links while signed out (`/billing` → login → return).
6. In embedded apps, use SDK settings for the user and `shellui.login()` for iframe-safe OAuth.

## Related guides

- [Backend](/backend) — provider comparison and configuration reference
- [Navigation](/features/navigation) — auth-related navigation properties
- [SDK](/sdk) — `shellui.login()` and settings payloads
- [Application settings](/features/application-settings) — per-app settings panels
