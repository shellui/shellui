---
title: Configure navigation
sidebar_label: Navigation
description: 'Define sidebar items and groups, hash-router URLs, auth visibility, and openIn modes in shellui.config.json.'
---

Navigation is an array on `ShellUIConfig`. Each item loads an iframe URL (or a built-in shell route) at a unique `path`. Groups add section titles. The same items feed sidebar, app bar, floating tabs, and the windows start menu - visibility depends on [layout](/features/layouts).

## Item fields

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: 'http://localhost:4000/',
      icon: '/icons/home.svg',
    },
    {
      label: 'About',
      path: 'about',
      url: 'https://example.com/about',
    },
  ],
};
```

- **`label`** (string | LocalizedString, required): display text
- **`path`** (string, required): unique id used in the shell URL (for example `/home`)
- **`url`** (string, required): iframe or route URL
- **`icon`** (string, optional): SVG path such as `/icons/home.svg`
- **`hidden`**: hide from sidebar and 404 links; the route still exists
- **`hideWhenLoggedOut`**: hide while signed out
- **`requiresAuth`**: redirect signed-out visitors to `/login?next=...`
- **`requiresDevMode`**: only when Settings → Advanced → Developer features is on
- **`requiresStaff`**: only staff (`isStaff`)
- **`hiddenOnMobile` / `hiddenOnDesktop`**: hide from the mobile sheet or desktop sidebar (ignored if `hidden` is true)
- **`openIn`**: `'default' | 'modal' | 'drawer' | 'external'`
- **`drawerPosition`**: `'top' | 'bottom' | 'left' | 'right'` when `openIn: 'drawer'`
- **`position`**: `'start'` (main) or `'end'` (footer / icon end of app bar)
- **`settings`**: URL of a panel under Settings → Applications - see [Application settings](/features/application-settings)
- **`useHashRouter`**: when `true`, treat as hash routing. If omitted, inferred from `url` containing `/#/`
- **`safeForAuthToken`**: `false` never shares the session JWT with that iframe. Default is trusted (`undefined` / `true`)

## Hash URL navigation

Apps that use hash routing (React Router `HashRouter`, Vue hash mode) need the literal sequence `/#/` in the item `url` and in links the shell opens.

- **Config:** `http://localhost:5173/#/` or `http://localhost:5173/#/themes` is treated as a hash-router app. You can also set `useHashRouter: true`.
- **Incoming URLs:** the shell applies hash logic only if the URL contains `/#/`. The part after `/#/` becomes the path inside the iframe. The shell's own URL stays path-based.

```typescript
navigation: [
  {
    label: 'Themes',
    path: 'themes',
    url: 'http://localhost:5173/#/themes',
  },
  {
    label: 'Home',
    path: 'home',
    url: 'http://localhost:5173/#/',
  },
];
```

Opening `http://localhost:5173/#/themes/foo` matches the Themes item and passes subpath `foo` to the iframe. URLs without `/#/` use pathname + search only.

## Groups

```typescript
navigation: [
  {
    label: 'Dashboard',
    path: 'dashboard',
    url: 'http://localhost:4000/',
  },
  {
    title: 'System',
    items: [
      {
        label: 'Settings',
        path: 'settings',
        url: 'http://localhost:4000/settings',
        icon: '/icons/settings.svg',
      },
    ],
  },
];
```

`title` may be a string or localized object. Groups also accept `position: 'end'`.

## Localized labels

When `language` includes more than one code, `label` and group `title` can be objects. See [Internationalization](/features/internationalization).

```typescript
label: {
  en: "Documentation",
  fr: "Documentation",
}
```

A plain string stays the same in every language.

## Visibility and protection

```json
{
  "label": "Admin Panel",
  "path": "admin",
  "url": "/admin",
  "hidden": true
}
```

```json
{
  "label": "Desktop Only",
  "path": "desktop",
  "url": "/desktop",
  "hiddenOnMobile": true
}
```

```json
{
  "label": "Billing",
  "path": "billing",
  "url": "https://app.example.com/billing",
  "hideWhenLoggedOut": true,
  "requiresAuth": true
}
```

If a signed-out visitor opens `/billing` with `requiresAuth`, the shell redirects to `/login?next=%2Fbilling` and returns after login. Logout from a `requiresAuth` route goes to `/` first. Details: [Authentication](/features/authentication).

## Opening modes

- **`default`**: main content iframe
- **`modal`**: overlay (desktop dialog / mobile sheet) - see [Modals and drawers](/features/modals-drawers)
- **`drawer`**: edge panel; `drawerPosition` defaults to `'right'`
- **`external`**: new tab (`target="_blank"`)

## Sidebar position

`position: 'start'` (default) is the main list. `position: 'end'` is the sidebar footer (or icon-only end of the app bar). Apply `position` on items or on groups.

## Related pages

- [Authentication](/features/authentication), [Layouts](/features/layouts), [Internationalization](/features/internationalization), [Modals and drawers](/features/modals-drawers)
