# Administration panel

Staff and company owners can open an embedded **administration** app from the account menu. The shell loads that app at `backend.adminPathname` (default `/admin`) from `backend.adminUrl`. You can also add **custom navigation** under Dashboard so operators jump straight to your product apps.

## Prerequisites

1. Configure a ShellUI identity backend (`backend.type: 'shellui'`). See [Backend](/backend).
2. Point `backend.adminPathname` and `backend.adminUrl` at the admin React app (local Vite server or production origin such as `https://admin.shellui.com`).
3. Sign in as a user with `isStaff` or `isCompanyOwner`.

Without `adminPathname` / `adminUrl`, the account menu does not show **Administration**.

## Embed the admin app

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  backend: {
    type: 'shellui',
    url: 'http://localhost:8000',
    companyId: 1,
    adminPathname: '/admin',
    // Local admin app: http://localhost:5174 — production: https://admin.shellui.com
    adminUrl: 'http://localhost:5174',
    login: {
      methods: ['oauth'],
      oauthProviders: ['github'],
    },
  },
};

export default config;
```

The shell registers a route at `adminPathname`, guards it for staff/owners, and embeds `adminUrl` in an iframe. Hash routes inside the admin app sync with the shell path (for example `/admin/users` ↔ `#/users`).

## Custom admin navigation

Use the top-level `administration` block to inject a titled section of links into the admin sidebar. Items appear **below Dashboard** and **above** the built-in Identity group, in the same order as in the config.

v1 is a **flat** list only (no nested groups). Each entry uses the same `NavigationItem` shape as host [navigation](/features/navigation) (`label`, `path`, `url`, optional `icon`, and the usual optional flags).

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  backend: {
    type: 'shellui',
    url: 'http://localhost:8000',
    companyId: 1,
    adminPathname: '/admin',
    adminUrl: 'http://localhost:5174',
  },
  administration: {
    title: {
      en: 'Applications',
      fr: 'Applications',
    },
    navigation: [
      {
        label: { en: 'Billing', fr: 'Facturation' },
        path: 'billing',
        url: 'https://billing.example.com/',
        icon: '/icons/billing.svg',
      },
      {
        label: 'Support desk',
        path: 'support',
        url: 'https://support.example.com/',
      },
    ],
  },
};

export default config;
```

### Fields

| Field                        | Required | Description                                                                                                     |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `administration.title`       | yes      | Section heading in the admin sidebar (string or localized object).                                              |
| `administration.navigation`  | yes      | Flat array of `NavigationItem`s. Order is preserved.                                                            |
| `navigation[].label`         | yes      | Link label (string or localized).                                                                               |
| `navigation[].path`          | yes      | Stable id used for the admin route (`#/app/<path>`). Avoid colliding with built-in paths like `users`.          |
| `navigation[].url`           | yes      | App URL loaded in the admin content iframe. Absolute `https://…` or relative to `backend.url` (e.g. `/admin/`). |
| `navigation[].icon`          | no       | Optional icon path from the host config (propagated via settings for a later UI pass).                          |
| `navigation[].requiresStaff` | no       | When `true`, only staff users see the link in the admin sidebar.                                                |
| `navigation[].openIn`        | no       | `'default'` (iframe) or `'external'` (new tab). Use `external` for apps that block framing (e.g. Django admin). |

### How it reaches the admin app

1. The shell includes a resolved `administration` object in SDK settings (`SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`).
2. Labels and the section title are resolved to the active language before propagation.
3. The admin app reads `settings.administration` and renders the section under Dashboard.
4. Clicking an item opens `#/app/<path>` inside admin and loads the item `url` in a registered ShellUI content iframe (settings are forwarded to the child frame). Relative URLs (starting with `/`) are resolved against `backend.url`. If `url` is empty, the first version falls back to `https://playground.shellui.com`.

### Staff-only Django admin

Staff users (`isStaff`) see a **Django admin** link (lock icon) under **Identity** that opens `{backend.url}/admin/` in a **new tab** (Django typically sets `X-Frame-Options` / CSP and cannot be embedded).

Configure the same entry under `administration.navigation` with `requiresStaff: true`, `url: '/admin/'`, and `openIn: 'external'`. Omit `openIn` (or use `'default'`) for URLs that are safe to embed in the admin content iframe.

```typescript
// Shape on Settings (from @shellui/sdk)
administration?: {
  title: string;
  navigation: Array<{
    path: string;
    url: string;
    label: string;
    icon?: string;
  }>;
} | null;
```

When `administration` is omitted from config, the shell sends `administration: null` and the admin sidebar shows only its built-in links.

## Related guides

- [Backend](/backend) — `adminPathname` / `adminUrl` and identity provider setup
- [Authentication](/features/authentication) — staff account menu and session propagation
- [Navigation](/features/navigation) — `NavigationItem` fields shared with host nav
- [SDK](/sdk) — settings messages between shell and iframes
