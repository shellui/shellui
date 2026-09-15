---
title: Connect a backend
sidebar_label: Backend
description: 'Choose identity-service, Supabase Auth, or no backend, then set the backend block in shellui.config.json.'
---

Point the shell at an auth API so `/login`, sessions, and guarded routes work. Shellui does not ship a user directory. You run [identity-service](https://github.com/shellui/identity-service), a [Supabase Auth](https://supabase.com/docs/guides/auth) project, or omit `backend` for a public shell. After this page, continue with [Authentication](/features/authentication).

## Providers

| Provider                 | `backend.type` | When to use it                                                                                  |
| ------------------------ | -------------- | ----------------------------------------------------------------------------------------------- |
| Shellui identity-service | `shellui`      | Self-hosted OAuth, company tenants, staff admin, JWT group and owner claims                     |
| Supabase Auth            | `supabase`     | Existing Supabase project or local `supabase` CLI (GoTrue-compatible endpoints)                 |
| None                     | omit `backend` | No sign-in. Auth APIs no-op. `requiresAuth` routes still redirect to `/login` without a session |

`BackendType` in `@shellui/core` is the list the current release accepts.

When `backend` is set, the shell:

- Renders `/login` and `/login/callback`, and intersects config login methods with live backend settings (`GET /api/v1/settings` for identity-service, Supabase auth settings for Supabase)
- Stores access and refresh tokens, refreshes before expiry, and exposes `useAuth()` in `@shellui/core`
- Sends user fields, staff flags, groups, and the access token to trusted iframes through SDK settings
- Optionally embeds a staff admin app when `adminPathname` and `adminUrl` are set (`type: "shellui"`). Extra sidebar links come from top-level `administration` - see [Administration](/features/administration)

Without `backend`, embedded apps do not receive auth settings, and login actions throw at runtime.

## identity-service

Set the API base URL with no trailing slash. Set `companyId` for multi-tenant OAuth. List methods and providers the login page may show; the backend still only enables providers it has credentials for.

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  backend: {
    type: 'shellui',
    url: 'http://localhost:8000',
    companyId: 1,
    adminPathname: '/admin',
    adminUrl: 'http://localhost:5174',
    login: {
      methods: ['oauth'],
      oauthProviders: ['github', 'google', 'microsoft'],
    },
  },
};

export default config;
```

Prefer the same fields in `shellui.config.json`. Register each OAuth app with a single identity callback: `http://localhost:8000/api/v1/oauth/callback` (no query string). Add each shell origin (for example `http://localhost:4000`) to the company OAuth redirect allowlist in admin or via `POST /api/v1/oauth-redirects`. Loopback (`127.0.0.1` / `localhost`) is always allowed for `shellui login`.

## Supabase Auth

Use the project URL and publishable (anon) key. Methods can include OAuth, magic link, and Web3 when those are enabled in the Supabase project.

```json
{
  "backend": {
    "type": "supabase",
    "url": "https://your_project.supabase.co",
    "publishableKey": "your_publishable_key_here",
    "login": {
      "methods": ["oauth", "magic_link", "web3"],
      "oauthProviders": ["github", "google", "apple", "microsoft"]
    }
  }
}
```

Local Supabase CLI commonly uses `url: "http://localhost:54321"` and the publishable key from `supabase status`. User preferences sync into `user_metadata.shelluiPreferences`.

## backend fields

| Field                  | Required               | Description                                                                               |
| ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| `type`                 | yes                    | `"shellui"` or `"supabase"`                                                               |
| `url`                  | yes                    | API base URL, no trailing slash                                                           |
| `publishableKey`       | Supabase               | Public key sent as `apikey` on auth requests                                              |
| `companyId`            | identity-service OAuth | Tenant id on authorize and code exchange                                                  |
| `adminPathname`        | no                     | Shell route for the admin iframe (account menu entry)                                     |
| `adminUrl`             | no                     | URL loaded in that route                                                                  |
| `loginUrl`             | no                     | Public origin of this shell for `shellui login` (not `adminUrl`)                          |
| `login.methods`        | no                     | `password` \| `oauth` \| `magic_link` \| `web3`. Intersected with backend settings        |
| `login.oauthProviders` | no                     | Provider ids for buttons and order (`github`, `google`, …)                                |
| `login.panelUrl`       | no                     | Full-bleed iframe for the desktop login left panel. Wins over `panelImage`                |
| `login.panelImage`     | no                     | Centered image path or URL for that panel (for example `/login-panel.jpg` from `static/`) |

Types: `BackendConfig` and `BackendLoginConfig` in `@shellui/core`. The stock login view does not render a password form even if `password` is listed.

**identity-service** fits dedicated `/api/v1/*` auth, company tenants, staff admin, and JWT `user_metadata` for groups and `is_company_owner`. **Supabase** fits an existing GoTrue project. **No backend** fits a public shell; add `backend` when you need login, `requiresAuth`, or user settings in child apps.

## Related pages

- [Authentication](/features/authentication) - routes, guards, session, SDK login
- [Administration](/features/administration) - staff iframe and custom nav
- [Navigation](/features/navigation) - `requiresAuth` and `hideWhenLoggedOut`
- [CLI](/cli) - JSON, split files, and env substitution
- [SDK](/sdk) - `shellui.login()` from iframes
