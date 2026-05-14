# Backend

After [Quick Start](/quickstart), choose how ShellUI talks to an auth and API provider. This page compares options and documents the `backend` block in `shellui.config.ts`. Continue with [Authentication](/features/authentication) to wire login and guarded routes.

ShellUI treats authentication and tenant-aware APIs as a **backend integration**. You choose a provider in `shellui.config.ts`; the shell handles login UI, session storage, token refresh, and propagating the signed-in user to embedded apps through the SDK.

ShellUI does not ship a database or user directory. You run (or subscribe to) a backend that issues tokens and exposes auth settings. The shell connects to that backend over HTTP.

## Supported providers today

| Provider                                               | `backend.type` | Typical use                                                                                                |
| ------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------- |
| ShellUI identity service                               | `shellui`      | Self-hosted OAuth, multi-tenant companies, staff admin, JWT claims for groups and company ownership        |
| [Supabase Auth](https://supabase.com/docs/guides/auth) | `supabase`     | Existing Supabase project, local Supabase CLI, or hosted Supabase with GoTrue-compatible endpoints         |
| None                                                   | omit `backend` | No sign-in; auth APIs are no-ops and protected routes still redirect to `/login` without a working session |

Additional backend types are planned. The `BackendType` union in `@shellui/core` is the source of truth for what the current release accepts.

## What the shell uses the backend for

When `backend` is set, ShellUI:

- Renders `/login` and `/login/callback` and merges **config** login capabilities with **live** settings from the backend (`GET /api/v1/settings` for ShellUI auth, Supabase auth settings for Supabase).
- Persists access and refresh tokens in the browser, refreshes before expiry, and exposes `useAuth()` in `@shellui/core`.
- Propagates user id, email, avatar, staff flag, groups, and access token to iframes via SDK settings (see [Authentication](/features/authentication) and [SDK](/sdk)).
- Optionally embeds a staff **admin** app when `adminPathname` and `adminUrl` are configured (`backend.type: "shellui"`).

Without `backend`, embedded apps do not receive auth settings and login actions throw at runtime.

## Minimal configuration

### ShellUI identity service

Point the shell at your identity service base URL (no trailing slash). Set `companyId` for multi-tenant OAuth. Declare which login methods and OAuth providers the login page should offer; the backend still only enables providers it has credentials for.

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

Run the identity service locally (see the `identity-service` package README in the monorepo): configure OAuth env vars, run migrations, and register OAuth apps with callback URL `http://localhost:8000/api/v1/oauth/callback` and shell origin `http://localhost:4000`.

### Supabase

Use your project URL and publishable (anon) key. Login methods can include OAuth, magic link, and Web3 depending on Supabase Auth configuration.

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  backend: {
    type: 'supabase',
    url: 'https://YOUR_PROJECT.supabase.co',
    publishableKey: 'sb_publishable_...',
    login: {
      methods: ['oauth', 'magic_link', 'web3'],
      oauthProviders: ['github', 'google', 'apple', 'microsoft'],
    },
  },
};

export default config;
```

Local Supabase CLI commonly uses `url: 'http://localhost:54321'` and the publishable key from `supabase status`.

## `backend` fields

| Field                  | Required      | Description                                                                                                                                 |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                 | yes           | `'shellui'` or `'supabase'`.                                                                                                                |
| `url`                  | yes           | API base URL (no trailing slash).                                                                                                           |
| `publishableKey`       | Supabase      | Public API key sent as `apikey` on auth requests.                                                                                           |
| `companyId`            | ShellUI OAuth | Tenant id sent on OAuth exchange and authorize flows.                                                                                       |
| `adminPathname`        | no            | Shell route path for the embedded admin panel (default staff entry from the user menu).                                                     |
| `adminUrl`             | no            | URL loaded inside the admin route (for example a Vite admin app).                                                                           |
| `login.methods`        | no            | `password` \| `oauth` \| `magic_link` \| `web3` — controls which controls the login page may show after intersecting with backend settings. |
| `login.oauthProviders` | no            | Provider ids (for example `github`, `google`) used for OAuth buttons and ordering.                                                          |

TypeScript types live in `BackendConfig` and `BackendLoginConfig` in `@shellui/core`.

## Choosing a provider

**ShellUI identity service** fits when you want a dedicated auth API aligned with ShellUI (company tenants, staff admin, JWT `user_metadata` for groups and `is_company_owner`, personal access tokens, and `/api/v1/*` routes). You operate the service or use a managed deployment.

**Supabase** fits when you already use Supabase for data and auth, or want GoTrue-compatible auth with minimal custom backend code. User preferences sync into `user_metadata.shelluiPreferences`.

**No backend** is valid for public shells or prototypes without sign-in. Add `backend` when you need login, `requiresAuth` routes, or user settings in child apps.

## Related guides

- [Authentication](/features/authentication) — login routes, guarded navigation, session and SDK usage
- [Navigation](/features/navigation) — `requiresAuth` and `hideWhenLoggedOut`
- [CLI configuration](/cli) — `backend` in JSON/TypeScript config
- [SDK](/sdk) — `shellui.login()` from iframes
