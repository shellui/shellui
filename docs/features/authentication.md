# Authentication

This guide follows [Backend](/backend) in the getting-started path. It covers sign-in configuration, built-in login routes, and navigation guards for developers hosting their own shell.

Shellui authentication is **configuration-driven**: set `backend` in `shellui.config.json`, declare login capabilities, protect navigation items, and use built-in routes at `/login` and `/login/callback`. The shell stores the session, refreshes tokens, and shares the signed-in user with embedded apps through the SDK.

## Prerequisites

Configure a backend provider first. See [Backend](/backend) for Shellui identity service vs Supabase and field reference.

## Enable authentication

Add a `backend` block to `shellui.config.json`. Without it, `useAuth()` reports signed out and login actions are unavailable.

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

`backend.login.methods` lists what the **login page is allowed to show**. At runtime Shellui intersects this list with settings from the backend so misconfigured providers are not offered.

| Method       | Login UI         | Notes                                                                                          |
| ------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| `oauth`      | Provider buttons | Requires `oauthProviders` and provider enabled on the backend.                                 |
| `magic_link` | Email field      | Supabase email auth; Shellui identity when the backend advertises it.                          |
| `web3`       | Ethereum wallet  | Supabase external provider / Shellui Web3 when enabled.                                        |
| `password`   | —                | Recognized in types and backend payloads; password UI is not rendered by the stock login view. |

`backend.login.oauthProviders` is an array of provider ids (for example `github`, `google`, `microsoft`, `apple`). Shellui deduplicates and lowercases them. For Shellui auth, per-company OAuth clients from `/api/v1/settings` appear as separate buttons with labels.

### Provider-specific fields

**Shellui (`type: 'shellui'`)**

- `url` — identity service origin.
- `companyId` — required for OAuth code exchange.
- `adminPathname` / `adminUrl` — optional staff admin iframe; staff users see **Administration** in the account menu when `adminPathname` is set. Add top-level `administration` to inject custom sidebar links (see [Administration panel](/features/administration)).

**Supabase (`type: 'supabase'`)**

- `url` — project URL (hosted or `http://localhost:54321`).
- `publishableKey` — required for refresh and user metadata calls.

## Login page and routes

Shellui registers fixed auth routes (see `urls` in `@shellui/core`):

| Path              | Purpose                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `/login`          | Login view: OAuth, magic link, Web3, legal links, `next` redirect handling |
| `/login/callback` | OAuth callback handler (authorization code exchange)                       |

You do **not** implement these pages in your microfrontends. They are part of the shell router.

### Login left panel branding

On desktop, `/login` shows a full-height left panel beside the sign-in form. Both branding fields are optional — omit them to keep the default muted panel with the shell `appIcon` in the top left (same mark as the layout chrome).

| Field        | Behavior                                                                             |
| ------------ | ------------------------------------------------------------------------------------ |
| `panelUrl`   | Full-bleed iframe filling the left half. Wins when both fields are set.              |
| `panelImage` | Centered image scaled with `object-contain` (full width or height, ratio preserved). |
| _(neither)_  | Grey (`bg-muted/40`) panel with clickable `appIcon` top left (links home).           |

On mobile, the same square `appIcon` is pinned top-left while the sign-in form stays vertically centered. Full-screen login also shows discreet language (when multiple languages are configured) and light/dark controls at the top right of the form column.

```typescript
const config: ShellUIConfig = {
  backend: {
    type: 'shellui',
    url: 'http://localhost:8000',
    login: {
      methods: ['oauth'],
      oauthProviders: ['github'],
      // Prefer one of:
      panelUrl: 'http://localhost:5176/login-branding/',
      // panelImage: '/login-panel.jpg',
    },
  },
};
```

Relative image paths (e.g. `/login-panel.jpg`) are served from `static/`. The left panel is hidden on mobile and when login is embedded in a modal iframe.

### `next` query parameter

Protected routes redirect to `/login?next=<encoded-path>`. After a successful sign-in, Shellui navigates to `next` (normalized to an in-app path). Example: `/billing` → `/login?next=%2Fbilling`.

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

`AuthUser` includes `id`, `email`, `name`, `profilePicture`, `isStaff`, `isCompanyOwner` (Shellui JWT), `authProvider`, and `groups`. `AuthSession` holds tokens and expiry for advanced use.

Sessions persist in browser storage; the shell refreshes access tokens before expiry and on a timer while the tab is open. With the Shellui identity service, the provider redirects to identity `/api/v1/oauth/callback`, which then bounces to the shell `/login/callback` with tokens in the URL hash. The shell persists them and strips the hash. Older IdP configs that still send `?code=` to the shell continue to use `POST /oauth/exchange`.

Register the identity callback URL on GitHub/Google/Microsoft (not each shell URL). Add every browser shell **origin** to the company OAuth redirect allowlist so `redirect_to` is accepted.

## Company access and pending accounts

When the Shellui identity service uses a non-public company join mode (`domain` or `invite`), OAuth may create the user but **not** issue tokens for that company. Access is stored per company (`CompanyMembership.is_enabled`), so the same person can be approved in one tenant and blocked in another.

The backend returns `error_code` `access_pending` or `access_denied` (also as `shellui_oauth_error_code` on bounce redirects). Shellui then shows a dedicated pending-access screen. After an admin enables membership for that company, the user can sign in. Configure modes in admin **Organization** or `PATCH /api/v1/companies/<id>/` — see identity-service company access docs.

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

Signed-in users open **Settings** (built-in route) for account fields, theme, language, and region. Shellui syncs preferences with the backend (`user_metadata` / Shellui preferences endpoints) when configured.

Legal document links on the login page come from `legalDocuments` in config; see [Legal documents](/features/legal-documents).

## Checklist

1. Choose [Backend](/backend) provider and run it (identity service or Supabase).
2. Set `backend.type`, `url`, and provider-specific keys in `shellui.config.json`.
3. Set `backend.login.methods` and `oauthProviders` to match what the backend enables.
4. Mark sensitive nav items with `requiresAuth` and optionally `hideWhenLoggedOut`.
5. Test deep links while signed out (`/billing` → login → return).
6. In embedded apps, use SDK settings for the user and `shellui.login()` for iframe-safe OAuth.

## Related guides

- [Backend](/backend) — provider comparison and configuration reference
- [Navigation](/features/navigation) — auth-related navigation properties
- [SDK](/sdk) — `shellui.login()` and settings payloads
- [Application settings](/features/application-settings) — per-app settings panels
