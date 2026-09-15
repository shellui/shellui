---
title: Open modals and drawers
sidebar_label: Modals & Drawers
description: 'Open iframe URLs in host modals and drawers from navigation or shellui.openModal / openDrawer.'
---

Modals and drawers are host overlays. Configure `openIn` on a navigation item, or call the SDK. Both share size presets, close chrome, and dismiss flags. On viewports below 768px, `openModal` and `openDrawer` present as a bottom sheet. Resizing across that breakpoint changes chrome only - the iframe stays mounted, so typed form state is kept.

## Open from navigation

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
      openIn: 'modal',
    },
    {
      label: 'Filters',
      path: 'filters',
      url: '/filters',
      openIn: 'drawer',
      drawerPosition: 'right',
    },
  ],
};
```

`drawerPosition`: `'top' | 'bottom' | 'left' | 'right'` (default `'right'`).

## Open from the SDK

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();

shellui.openModal('/settings');

shellui.openModal({
  url: '/settings',
  size: 'lg',
  dynamicSizing: false,
  showCloseButton: true,
  dismissible: true,
  closeOnOverlayClick: true,
  movable: true,
  resizable: true,
});

shellui.closeModal();
```

On desktop and tablet, modals are movable (drag the top edge) and resizable (edges and corners) by default. The move hit target sits on the frame edge so content buttons stay clickable. Pass `movable: false` / `resizable: false` to lock them. Mobile sheet presentation ignores those flags.

Close paths: overlay × when `showCloseButton` is true (default); backdrop when `closeOnOverlayClick` is true; Escape and swipe when `dismissible` is true. If `showCloseButton` is false, your iframe should call `shellui.closeModal()`.

## Drawers

Desktop and tablet honor `left` / `right` / `top` / `bottom`. Below 768px every drawer is a bottom sheet (same chrome as mobile `openModal`).

```typescript
shellui.openDrawer({
  url: '/filters',
  position: 'left',
  size: 'md',
  showCloseButton: true,
  showDragHandle: true,
  dismissible: true,
  closeOnOverlayClick: true,
  resizable: true,
});

shellui.openDrawer({
  url: '/panel',
  position: 'bottom',
  size: '80vh',
});

shellui.closeDrawer();
```

When `dismissible` is true, top/bottom drawers show a drag handle: drag down on bottom (and all mobile drawers); drag up on top (desktop/tablet). Left/right drawers on desktop have no Vaul handle - dismiss with ×, backdrop, or Escape. Set `showDragHandle: false` to hide the bar. Desktop drawers resize from the free edge by default (`resizable: false` to lock). They are not movable. Resize is off on mobile.

Left/right freeform widths (`"60vw"`, `"400px"`) map to the default bottom-sheet height (80% of `--shellui-overlay-max-height`) on mobile. Presets and top/bottom heights keep their vertical meaning.

## Size presets

| Preset    | Modal (desktop)           | Drawer (vertical)              | Drawer (horizontal) |
| --------- | ------------------------- | ------------------------------ | ------------------- |
| `sm`      | narrow                    | ~40% of overlay max            | ~20rem              |
| `md`      | medium                    | ~55%                           | ~28rem              |
| `lg`      | default modal chrome      | ~75%                           | ~36rem              |
| `xl`      | large                     | ~90%                           | ~48rem              |
| `full`    | near-viewport             | `--shellui-overlay-max-height` | 100%                |
| `content` | grows with iframe reports | auto                           | auto                |

Sizes clamp to `--shellui-overlay-max-height` (`--shellui-app-height` minus top safe area). You can pass `width` / `height` / `maxWidth` / `maxHeight` (CSS length or px number). Drawers still accept freeform CSS lengths for the primary dimension.

## Dynamic height

Same-origin `contentDocument` measurement is unreliable for microfrontends. Use the message protocol.

```typescript
shellui.openModal({ url: '/confirm', dynamicSizing: true });
shellui.openModal({ url: '/confirm', size: 'content' });
```

While `dynamicSizing` is on, manual resize is disabled. Movable modals still work.

In the iframe:

```typescript
await shellui.init();

const stop = shellui.overlay.autoSize({
  observe: true,
  target: document.querySelector('[data-overlay-root]'),
});

shellui.overlay.reportSize({ height: 480 });
```

Prefer `target` = a content-sized root. Observing `html`/`body` with `height: 100%` misses growth. Optional `debounceMs` (default 0 = next animation frame). `autoSize` skips sub-2px no-ops.

`SHELLUI_OVERLAY_SIZE` payload: `{ version: 1, height, width?, overlayId? }`. The parent listens only while a dynamic overlay is open. Height clamps (~40px min, ~92% viewport max) and scrolls if larger. If no messages arrive, the shell uses a viewport-relative height with inner scroll. Until the first report, dynamic **modals** open as a compact square with a spinner; dynamic **drawers** open as a 40px loading strip; both then snap (no size tween). On close, the last size is kept through the exit animation.

Avoid `vh` / `%` height in iframe content with dynamic sizing: those units track the iframe viewport and fight the shell as it grows. Prefer `px` / `rem` for tall blocks.

Overlay chrome uses existing design tokens. Light and dark apply without hardcoded colors.

Do not nest overlays. When you disable Escape or backdrop click, document how to dismiss. Types: `OpenModalOptions`, `OpenDrawerOptions` from `@shellui/sdk`.

## Related pages

- [Navigation](/features/navigation), [Toasts](/features/toasts), [Dialogs](/features/dialogs), [SDK](/sdk)
