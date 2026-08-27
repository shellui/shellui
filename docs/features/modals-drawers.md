# Modals & Drawers

Shellui supports opening content in modal overlays and side drawer panels, providing flexible ways to display content without navigating away from the current page.

Modals and drawers share one options surface: size presets, optional close chrome, and dismiss behavior. On mobile, `openModal` presents as a bottom drawer automatically.

## Modals

Modals display content in a centered overlay with a backdrop on desktop — perfect for focused interactions like settings or forms. On viewports below 768px, the same `openModal` API morphs into a bottom sheet (drag handle + swipe-to-dismiss).

**Content continuity:** resizing across the mobile breakpoint only changes chrome (dialog ↔ sheet). The iframe stays mounted — typed form state is not reloaded.

### Opening Modals via Navigation

Configure navigation items to open in modal mode:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
      openIn: 'modal', // Opens in modal overlay
    },
  ],
};
```

### Opening Modals Programmatically

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

// Simple URL (desktop dialog / mobile bottom drawer)
shellui.openModal('/settings');

// Options object
shellui.openModal({
  url: '/settings',
  size: 'lg', // sm | md | lg | xl | full | content
  dynamicSizing: false, // true → height follows iframe reports
  showCloseButton: true, // default true — set false so the app owns dismiss UI
  dismissible: true, // Escape / swipe (default true)
  closeOnOverlayClick: true, // backdrop click (default true)
  movable: true, // drag top edge on desktop/tablet (default true)
  resizable: true, // resize from edges/corners (default true; off when dynamicSizing)
});
```

On desktop and tablet, modals are **movable** (drag the top edge — grab cursor on the border) and **resizable** (edges and corners) by default. The move hit target sits on the frame edge so content buttons stay clickable. Pass `movable: false` / `resizable: false` to lock them. Mobile sheet presentation ignores these flags.

### Closing Modals

Modals can be closed by:

- The overlay close (×) control — when `showCloseButton` is true (default)
- Clicking the backdrop — when `closeOnOverlayClick` is true (default)
- Pressing Escape — when `dismissible` is true (default)
- Swipe-to-dismiss on mobile (bottom sheet) — when `dismissible` is true
- Programmatically:

```javascript
shellui.closeModal();
```

When `showCloseButton: false`, Escape / backdrop / swipe still follow the flags above; your iframe content should provide its own close action (and typically call `shellui.closeModal()`).

Resizing the window between desktop and mobile while a modal is open keeps the same iframe instance (no remount / no lost input).

## Drawers

Drawers slide in from the edges of the screen, perfect for sidebars, panels, or secondary content. Side drawers remain available on all viewports (`left` / `right` / `top` / `bottom`).

### Opening Drawers via Navigation

```typescript
const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Sidebar',
      path: 'sidebar',
      url: '/sidebar',
      openIn: 'drawer',
      drawerPosition: 'right', // Optional, defaults to 'right'
    },
  ],
};
```

### Drawer Positions

```typescript
{ openIn: 'drawer', drawerPosition: 'top' }
{ openIn: 'drawer', drawerPosition: 'bottom' }
{ openIn: 'drawer', drawerPosition: 'left' }
{ openIn: 'drawer', drawerPosition: 'right' } // default
```

### Opening Drawers Programmatically

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

shellui.openDrawer({
  url: '/settings',
});

shellui.openDrawer({
  url: '/sidebar',
  position: 'left',
  size: 'md', // preset
  showCloseButton: true,
  showDragHandle: true, // default when dismissible
  dismissible: true,
  closeOnOverlayClick: true,
  resizable: true, // default on desktop — drag free edge; not movable
});

// Freeform CSS length (backward compatible)
shellui.openDrawer({
  url: '/panel',
  position: 'bottom',
  size: '80vh',
});
```

### Drawer Gestures

When `dismissible` is true (default), drawers show a theme-aware drag handle and support swipe-to-dismiss:

- **Bottom**: drag down
- **Top**: drag up
- **Left / right**: drag toward the dismiss edge

Set `showDragHandle: false` to hide the bar while keeping other dismiss paths, or `dismissible: false` to disable swipe / Escape.

On desktop, drawers are **resizable** by default from the free edge (width for left/right, height for top/bottom). They are not movable. Pass `resizable: false` to lock size. Resize is disabled on mobile.

### Closing Drawers

- Overlay close (×) when `showCloseButton` is true
- Backdrop click when `closeOnOverlayClick` is true
- Escape / swipe when `dismissible` is true
- Programmatically: `shellui.closeDrawer()`

## Size

### Presets

| Preset    | Modal (desktop)                 | Drawer (vertical) | Drawer (horizontal) |
| --------- | ------------------------------- | ----------------- | ------------------- |
| `sm`      | narrow                          | ~40dvh            | ~20rem              |
| `md`      | medium                          | ~55dvh            | ~28rem              |
| `lg`      | default (previous modal chrome) | ~75dvh            | ~36rem              |
| `xl`      | large                           | ~90dvh            | ~48rem              |
| `full`    | near-viewport                   | 100dvh            | 100%                |
| `content` | grows with iframe size reports  | auto height/width | auto                |

All sizes are clamped to the viewport (`dvh` / safe max). You can also pass explicit `width` / `height` / `maxWidth` / `maxHeight` (CSS length or px number).

Drawers still accept freeform CSS lengths (`"400px"`, `"50vw"`) for the primary dimension.

### Iframe auto-height (`dynamicSizing`)

Same-origin `contentDocument` hacks are unreliable for microfrontends. Use the SDK message protocol instead.

**Parent (open the overlay with dynamic sizing):**

```javascript
shellui.openModal({ url: '/confirm', dynamicSizing: true });
shellui.openDrawer({ url: '/confirm', position: 'bottom', dynamicSizing: true });

// Equivalent: size: 'content'
shellui.openModal({ url: '/confirm', size: 'content' });
```

While `dynamicSizing` is on, **manual resize is disabled** (auto height and drag-resize would fight). Movable modals still work.

**Child (iframe app):**

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

// Observe with ResizeObserver — immediate by default (optional debounceMs), skips &lt;2px no-ops
// Prefer `target` = your content root (grows with children)
const stop = shellui.overlay.autoSize({
  observe: true,
  target: document.querySelector('[data-overlay-root]'),
});
// later: stop() or shellui.overlay.autoSize({ observe: false })

// Or one-shot
shellui.overlay.reportSize({ height: 480 });
```

**Message contract** (`SHELLUI_OVERLAY_SIZE`):

```json
{
  "type": "SHELLUI_OVERLAY_SIZE",
  "payload": {
    "version": 1,
    "height": 480,
    "width": 640,
    "overlayId": "optional-id"
  }
}
```

- `height` (required): content height in CSS pixels
- `width` (optional, reported by default from `autoSize`): content width in CSS pixels
- Parent listens only while a modal/drawer with dynamic sizing is open
- Clamps to min (~40px) and max (~92% of viewport); scrolls if content exceeds max
- **Fallback:** if no size messages arrive, uses a viewport-relative height with inner scroll
- **Pending chrome:** until the first size report, dynamic **modals** open as a compact square with a spinner; dynamic **drawers** open as a **40px** full-bleed loading strip. Both then **snap** to the reported size (no size tween)
- On close, the last size is kept through the exit animation (does not shrink back to the spinner)
- **Avoid `vh` / `%` height in iframe content** when using dynamic sizing: those units are relative to the iframe viewport. As the shell grows the iframe, content height grows again → stepped “jumping” resize. Prefer fixed `px` / `rem` for tall blocks.

## Theming & polish

Overlay chrome uses existing design tokens (`--background`, `--border`, `--muted-foreground`, etc.). Light and dark themes apply with no hardcoded colors. Open/close use short ease transitions; dynamic content sizing snaps with no size tween.

## Use Cases

### Modals

- Settings panels, forms, focused details
- Prefer `openModal` when you want desktop dialog + mobile bottom sheet from one call

### Drawers

- Sidebars, filters, persistent panels
- Use an explicit `position` when you need a side edge on mobile too

## Best Practices

1. Choose the right overlay: modals for focus, drawers for secondary chrome
2. Use presets (`sm`–`xl`) unless you need a freeform CSS length
3. Use `dynamicSizing: true` + `shellui.overlay.autoSize()` for confirm panels that should hug content
4. Set `showCloseButton: false` when the app provides its own dismiss control
5. Don't nest overlays
6. Document dismiss behavior for your users when you disable Escape or backdrop click

## Related Guides

- [Navigation](/features/navigation) - Learn about navigation configuration
- [Toast Notifications](/features/toasts) - For non-blocking notifications
- [Alert Dialogs](/features/dialogs) - For confirmations and prompts
- [SDK Integration](/sdk) - Learn about the Shellui SDK
