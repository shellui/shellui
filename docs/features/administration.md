---
title: Embed the administration panel
sidebar_label: Administration
description: Point backend.adminUrl at the staff admin app and add custom sidebar links with administration.navigation.
---

Staff and company owners open an embedded administration app from the account menu. The shell loads `backend.adminUrl` at `backend.adminPathname` (default `/admin`). Top-level `administration` injects extra sidebar links below Dashboard.

## Prerequisites

1. `backend.type: "shellui"` - see [Backend](/backend)
2. `backend.adminPathname` and `backend.adminUrl` (local Vite such as `http://localhost:5174`, or `https://admin.shellui.com`)
3. Sign in as a user with `isStaff` or `isCompanyOwner`

Without `adminPathname` / `adminUrl`, the account menu omits **Administration**.

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://localhost:8000",
    "companyId": 1,
    "adminPathname": "/admin",
    "adminUrl": "http://localhost:5174",
    "login": {
      "methods": ["oauth"],
      "oauthProviders": ["github"]
    }
  }
}
```

The shell registers a staff/owner-guarded route and embeds `adminUrl`. Hash routes inside the admin app sync with the shell path (`/admin/users` ↔ `#/users`).

## Custom admin navigation

v1 is a **flat** list (no nested groups). Items appear below Dashboard and above the built-in Identity group, in config order. Each entry uses the host [NavigationItem](/features/navigation) shape.

```typescript
import type { ShellUIConfig } from "@shellui/core";

const config: ShellUIConfig = {
  backend: {
    type: "shellui",
    url: "http://localhost:8000",
    companyId: 1,
    adminPathname: "/admin",
    adminUrl: "http://localhost:5174",
  },
  administration: {
    title: {
      en: "Applications",
      fr: "Applications",
    },
    navigation: [
      {
        label: { en: "Billing", fr: "Facturation" },
        path: "billing",
        url: "https://billing.example.com/",
        icon: "/icons/billing.svg",
      },
      {
        label: "Support desk",
        path: "support",
        url: "https://support.example.com/",
      },
    ],
  },
};

export default config;
```

| Field | Required | Description |
| --- | --- | --- |
| `administration.title` | yes | Section heading (string or localized) |
| `administration.navigation` | yes | Flat `NavigationItem` array |
| `navigation[].label` / `path` / `url` | yes | `path` becomes `#/app/<path>` - avoid colliding with built-in ids such as `users` |
| `navigation[].icon` | no | Icon path from the host |
| `navigation[].requiresStaff` | no | Staff-only sidebar row |
| `navigation[].openIn` | no | `'default'` (iframe) or `'external'` (new tab) for apps that block framing |

The shell sends a language-resolved `administration` object on `SHELLUI_SETTINGS`. The admin app reads `settings.administration`. Relative URLs starting with `/` resolve against `backend.url`. If `url` is empty, the first version falls back to `https://playground.shellui.com`. When `administration` is omitted, the shell sends `administration: null` and the admin sidebar shows built-in links only.

Staff (`isStaff`) also see a **Django admin** link under Identity that opens `{backend.url}/admin/` in a **new tab** (Django sets `X-Frame-Options` / CSP that blocks framing). Mirror that with `requiresStaff: true`, `url: "/admin/"`, and `openIn: "external"`.

Admin → Storage appears when `storage.url` is set - see [Storage](/features/storage). Optional `hosting.showInAdmin: false` hides Admin → Hosting even if `hosting.url` is set.

## Related pages

- [Backend](/backend), [Authentication](/features/authentication), [Navigation](/features/navigation), [SDK](/sdk)
