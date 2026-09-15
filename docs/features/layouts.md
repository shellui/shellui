---
title: Choose a layout
sidebar_label: Layouts
description: 'Set layout in shellui.config.json - sidebar, inset, fullscreen, app bar, floating, or experimental windows.'
---

`layout` is a shell concern (`shellui.config.json`). App UI must work in sidebar, top-bar, and window modes. Default is `sidebar`. Override at runtime from **Settings → Develop → Layout** when developer features are enabled (stored in user settings, wins over config).

```json
{
  "layout": "sidebar"
}
```

Allowed values: `sidebar`, `sidebar-inset`, `fullscreen`, `windows`, `app-bar`, `app-bar-inset`, `floating`. Legacy `cupertino` maps to `floating`.

Iframe apps should size to `100%` of the iframe, not `100vh`, unless you subtract host chrome. Prefer `%` / flex inside the iframe.

## Sidebar (default)

Persistent navigation built on shadcn/ui sidebar primitives.

- Desktop: collapsible icon rail (trigger, rail, or `⌘B` / `Ctrl+B`)
- Desktop: drag the expanded border to resize (230-480px; persisted for the tab session)
- Mobile: sheet opened from the top header
- Themed via `--sidebar-*` for light and dark
- Optional `appIcon` at the top of the expanded sidebar (hidden when collapsed)

**Tauri (macOS):** overlay titlebar; traffic lights centered in 42px chrome. Collapsed sidebar gets a full-width 42px top bar (Back/Forward + open-sidebar). A full-width invisible 42px drag strip mounts at the app root, including error screens. **Back** / **Forward** leave iframe login pages because there is no browser chrome.

## Sidebar inset

Same as sidebar with a padded, rounded main frame that shows chrome around the content area on desktop (`variant="inset"`).

```json
{
  "layout": "sidebar-inset"
}
```

## Floating

Glass chrome over full-bleed content. The iframe stays 100% × 100%; apps apply insets **inside** their UI.

| Viewport | Width        | Chrome                           |
| -------- | ------------ | -------------------------------- |
| Mobile   | `<768px`     | Floating bottom-centered tab bar |
| Tablet   | `768-1023px` | Same bottom tab bar              |
| Desktop  | `≥1024px`    | Floating glass sidebar           |

Hide-on-scroll: scrolling down hides chrome; scrolling up, near the top, or near the bottom restores it. Soft fade masks on phone/tablet hint at scroll. Prefer a small set of top-level start items (about 5); extras go under More.

Floating publishes `layoutChrome` on `SHELLUI_SETTINGS` and `SHELLUI_LAYOUT_CHROME` to the **main** content iframe only.

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();
shellui.getLayoutChrome();
shellui.applyLayoutChrome();
```

CSS variables: `--shellui-inset-top|right|bottom|left`. Nested overflow scrollers should call `shellui.reportContentScroll`. Tiny CDN clients get the same snapshot, `applyLayoutChrome()`, `reportContentScroll()`, and a `chrome` event. See [SDK](/sdk).

## Branding (`appIcon` / `logo`)

```json
{
  "appIcon": "/app-icon.svg",
  "logo": "/logo.svg"
}
```

- **`appIcon`**: small square mark in sidebar header (expanded), app-bar start, windows start button, and floating desktop sidebar. A single SVG or mono PNG is recolored for light/dark. Paired files: `{ "light": "/app-icon-light.png", "dark": "/app-icon-dark.png" }`.
- **`logo`**: wider wordmark. Prefer `appIcon` for chrome.

## Fullscreen

Content area only - no sidebar or nav chrome. Routes in `navigation` still work via direct URLs. Height fills `#root` (`h-full`), not raw `100vh`. Useful for kiosk or embedding.

## App bar / app-bar inset

Compact top bar (~52px). Start destinations are icon + label links. Groups use a caret dropdown (category looks selected when a child is active). Overflow goes into **More**. End links (`position: 'end'`) are icon-only with a tooltip. `app-bar-inset` uses the same padded, rounded main frame as sidebar-inset.

**Tauri:** traffic-light inset, Back/Forward, and drag regions on the bar.

## Windows (experimental)

Taskbar, start menu, and one draggable window per navigation item. Implemented as a proof of concept. You can try it from Settings → Develop → Layout. It is **not** recommended for production.

- Start menu sections follow navigation groups
- Window positions and sizes persist for the session
- Desktop background is a primary-color wash from the active theme
- No hard cap on open windows; extra windows cost performance

## Mobile and iOS fullscreen (all layouts)

- Shell height uses `--shellui-app-height` (`100dvh`). Safe-area insets are **padding only** on titlebars, sheets, and login. The main iframe fills to the physical bottom - do not pad the outlet with bottom safe-area or the iframe looks cut off.
- Installed / standalone apps use `@media (display-mode: standalone)` for body layout.
- Pad your own bottom chrome with `env(safe-area-inset-*)` when UI sits on the home-indicator band.
- Shell-owned pages (login, access pending, errors) use `.shellui-safe-pad`.

## Related pages

- [Navigation](/features/navigation), [Themes](/features/themes), [SDK](/sdk)
