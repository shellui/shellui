---
title: Configure authentication
sidebar_label: Authentication
description: 'Set backend.login, use /login and /login/callback, guard routes with requiresAuth, and call shellui.login from iframes.'
---

Configure sign-in on the shell: `backend` in `shellui.config.json`, built-in routes at `/login` and `/login/callback`, and navigation guards. The shell stores the session, refreshes tokens, and shares the signed-in user with trusted iframe apps. Choose a provider on [Connect a backend](/backend) first.

## Enable authentication

Add a `backend` block. Without it, `useAuth()` reports signed out and login actions are unavailable.

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://localhost:8000",
    "companyId": 1,
    "login": {
      "methods": ["oauth", "magic_link"],
      "oauthProviders": ["github", "google"]
    }
  }
}
```

`backend.login.methods` lists what the **login page may show**. At runtime the shell intersects that list with backend settings so disabled providers stay hidden.

| Method       | Login UI         | Notes                                                                     |
| ------------ | ---------------- | ------------------------------------------------------------------------- |
| `oauth`      | Provider buttons | Needs `oauthProviders` and a backend-enabled provider                     |
| `magic_link` | Email field      | Supabase email auth; identity-service when advertised                     |
| `web3`       | Ethereum wallet  | When the backend enables it                                               |
| `password`   | none             | Typed and forwarded; the stock login view does not render a password form |

`oauthProviders` is an array of ids (`github`, `google`, `microsoft`, `apple`). Shellui deduplicates and lowercases them. For identity-service, per-company OAuth clients from `/api/v1/settings` appear as separate labeled buttons.

**identity-service** needs `url` and `companyId` for OAuth. Optional `adminPathname` / `adminUrl` add **Administration** in the account menu for staff/owners - see [Administration](/features/administration). **Supabase** needs `url` and `publishableKey`.

## Login routes

The shell registers these paths (`urls` in `@shellui/core/constants/urls`). You do not implement them in microfrontends.

| Path              | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `/login`          | OAuth, magic link, Web3, legal links, `next` redirect |
| `/login/callback` | OAuth callback (authorization code exchange)          |

Protected routes redirect to `/login?next=<encoded-path>`. After sign-in, the shell navigates to `next` as an in-app path. Example: `/billing` → `/login?next=%2Fbilling`.

### Login left panel

On desktop, `/login` shows a full-height left panel. Both branding fields are optional.

| Field        | Behavior                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panelUrl`   | Full-bleed iframe. Wins when both fields are set. Must be a same-origin relative path, a configured backend/login/storage origin, or (development only) a loopback URL; untrusted URLs are ignored |
| `panelImage` | Centered `object-contain` image                                                                                                                                                                    |
| neither      | Muted panel with clickable `appIcon` top left (links home)                                                                                                                                         |

On mobile, the square `appIcon` is pinned top-left and the form stays centered. Language (when multiple languages are configured) and light/dark controls sit at the top right of the form column. The form uses `.shellui-safe-pad` for notches. Relative image paths are served from `static/`. The left panel is hidden on mobile and when login is embedded in a modal iframe.

```typescript
login: {
  methods: ["oauth"],
  oauthProviders: ["github"],
  panelUrl: "http://localhost:5176/login-branding/",
  // panelImage: "/login-panel.jpg",
}
```

### Optional login nav item

The shell always exposes `/login`. Add a nav entry to open it in the main area, a modal, or a drawer:

```typescript
import type { ShellUIConfig } from '@shellui/core';
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

When a session exists, login entries whose URL matches the shell login route are hidden from the sidebar. The header account control (avatar or Login) remains in supported layouts.

Layouts with a sidebar, app bar, or Windows taskbar render that control: signed-out users go to `/login`; signed-in users get profile, settings, optional administration, and logout. Logout from a `requiresAuth` route navigates to `/` first so you are not sent straight back to login.

## Guard routes

See [Navigation](/features/navigation) for the full item shape.

**`requiresAuth`:** direct navigation checks the session. While auth is loading, the route shows a fallback; when signed out, the shell redirects to `/login?next=...`. The iframe URL does not load until you sign in.

```json
{
  "label": "Billing",
  "path": "billing",
  "url": "https://app.example.com/billing",
  "requiresAuth": true
}
```

**`hideWhenLoggedOut`:** omit the item from the sidebar and 404 suggestions while signed out. Combine with `requiresAuth` to hide and protect.

`filterNavigationForAuthState` removes `hideWhenLoggedOut` items when signed out and hides login nav URLs when signed in. `requiresDevMode` items are unchanged by auth.

## Session in the host

```typescript
import { useAuth } from "@shellui/core";

function Example() {
  const { user, isAuthenticated, isLoading, logout, startOAuth } = useAuth();
  void startOAuth;

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

Sessions persist in browser storage. The shell refreshes access tokens before expiry while the tab is open. With identity-service, the provider redirects to `/api/v1/oauth/callback`, which bounces to the shell `/login/callback` with tokens in the URL hash. The shell persists them and strips the hash. Older IdP configs that still send `?code=` to the shell continue to use `POST /oauth/exchange`.

Register the identity callback URL on GitHub/Google/Microsoft (not each shell URL). Add every browser shell **origin** to the company OAuth redirect allowlist so `redirect_to` is accepted.

## Company access pending

When identity-service uses a non-public company join mode (`domain` or `invite`), OAuth may create an account but not issue tokens for that company. Access is stored per company (`CompanyMembership.is_enabled`).

The backend returns `error_code` `access_pending` or `access_denied` (also as `shellui_oauth_error_code` on bounce redirects). The shell then shows a pending-access screen. After an admin enables membership, sign in again. Configure modes in admin **Organization** or `PATCH /api/v1/companies/<id>/`.

## Iframe apps

Iframes do not read storage directly. They receive `user` and `accessToken` through SDK settings after the shell initializes auth.

```typescript
import { shellui } from '@shellui/sdk';

shellui.login({
  method: 'oauth',
  provider: 'github',
  redirectPath: '/login',
});
```

Supported `method` values: `oauth` (with `provider`), `web3`. Nested frames send `SHELLUI_LOGIN` to the root. When `backend.type` is `shellui`, settings include `authBackendBaseUrl` so admin tools call the same identity base URL.

Signed-in users open **Settings** for account fields, theme, language, and region. Preferences sync with the backend when configured. Legal links on the login page come from `legalDocuments` - see [Legal documents](/features/legal-documents).

## Checklist

1. Run identity-service or Supabase and set `backend.type`, `url`, and provider keys
2. Set `backend.login.methods` and `oauthProviders` to match the backend
3. Mark sensitive nav items with `requiresAuth` and optionally `hideWhenLoggedOut`
4. Test a signed-out deep link (`/billing` → login → return)
5. In embedded apps, read the signed-in profile from SDK settings and call `shellui.login()` for OAuth

## Related pages

- [Backend](/backend), [Navigation](/features/navigation), [SDK](/sdk), [Application settings](/features/application-settings)
