# Floating chrome actions

Optional **floating action chrome** owned by Shellui and driven by embedded apps through the SDK. Apps declare intent; the shell renders buttons above/below the iframe, reserves safe padding, and posts click events back into **that** iframe only.

## Quick start

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

shellui.actions.set({
  back: {
    id: 'back',
    onClick: () => history.back(),
  },
  title: 'Inbox',
  trailing: [
    { id: 'edit', label: 'Edit', onClick: () => {} },
    { id: 'share', label: 'Share', onClick: () => {} },
  ],
  primary: {
    id: 'compose',
    icon: 'plus',
    onClick: () => {},
  },
});

// When leaving the screen / route:
shellui.actions.clear();
```

## SPA navigation (important)

Shellui **does not** infer actions from the iframe URL or history. On every in-app route change you must:

1. `shellui.actions.set(...)` for the new screen, or
2. `shellui.actions.clear()` when the screen should not show chrome.

Shell navigation to another app / contentView clears that iframe’s actions and resets padding automatically.

## Density caps

| Slot       | Cap                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| `back`     | 1                                                                                                          |
| `title`    | 1                                                                                                          |
| `trailing` | up to 8 kept; **≤3 visible** on desktop (rest in `···`); on mobile/tablet all trailing collapse into `···` |
| `primary`  | 1 bottom FAB                                                                                               |

Missing `id` values are skipped (warned). Duplicate ids across slots are rejected.

## Clicks

Clicking a chrome control posts `SHELLUI_ACTION` with `{ id }` into **only** the declaring iframe. The SDK triggers the matching `onClick` registered by `actions.set`. Callbacks stay registered until the next `set` / `clear` (unlike one-shot toasts).

## Layouts

- **Floating / sidebar / app-bar:** top bar overlays the content iframe; primary FAB sits above floating tab bar when present (extra bottom inset).
- **Windows:** top actions render in the **window title bar**; FAB still overlays the window content.

## Icons

`icon` may be a URL or a built-in name: `back`, `plus`, `more`. Provide `label` and/or `icon`.

## Try it locally

Minimal smoke harness (not a product demo):

1. Run a Shellui app (`shellui start`).
2. Open **Settings → Develop**.
3. Use **Chrome actions** → **Open demo (modal iframe)** or **Open demo (drawer iframe)**.
4. Inside the demo iframe, use Set / Update / Clear. Clicks toast via the real `SHELLUI_ACTION` round-trip.

Narrow the viewport to exercise the `···` overflow menu.

**Clickable showcase (code sample + triggers):** separate PR on [shellui/playground](https://github.com/shellui/playground) (coming) — preferred place for the UX demo.

## Out of scope (v2+)

- Floating search / text-field slots
- Auto-inferring actions from iframe URL
