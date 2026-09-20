---
title: Call the iframe SDK
sidebar_label: SDK
description: 'Initialize @shellui/sdk in an embedded app for toasts, dialogs, overlays, storage, login, and settings.'
---

`@shellui/sdk` is how an iframe app talks to the shell (`init`, postMessage). Do not reach into host DOM. Theme, locale, toasts, dialogs, and overlays stay in host chrome. Call `init` before other full-SDK methods.

## Tiny CDN script

For pages that only need **theme**, **language/region**, **navigation**, and **layout chrome**, use `shellui.tiny.js` (~2 KB min / ~1 KB gzip). It handshakes on load - no `init()`.

```html
<script
  src="https://cdn.jsdelivr.net/npm/@shellui/sdk/dist/shellui.tiny.js"
  async
></script>
<script>
  shellui.ready.then(() => {
    shellui.applyTheme();
  });
  shellui.on('theme', () => shellui.applyTheme());
  shellui.navigate('/dashboard');
</script>
```

Or the package subpath:

```typescript
import shellui from '@shellui/sdk/tiny';

await shellui.ready;
shellui.applyTheme();
```

| Member                     | Role                                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| `ready`                    | Promise after handshake (or immediately outside an iframe)                       |
| `initialized`              | `boolean`                                                                        |
| `theme`                    | Snapshot (`mode`, `colorScheme`, `colors`, fonts) or `null`                      |
| `language`                 | Language code (for example `"en"`) or `null`                                     |
| `region`                   | `{ timezone }` or `null`                                                         |
| `layoutChrome`             | Safe-inset snapshot or `null`                                                    |
| `on(event, cb)`            | `'ready'`, `'theme'`, `'language'`, `'region'`, `'chrome'` - returns unsubscribe |
| `navigate(url)`            | Ask the shell to navigate                                                        |
| `applyTheme(el?)`          | Write CSS variables on `el` (default `<html>`) and toggle `dark`                 |
| `applyLayoutChrome(opts?)` | Write `--shellui-inset-*`; optional pad class on `body`                          |
| `reportContentScroll(p)`   | Tell the shell about scroll (hide-on-scroll for floating)                        |

URL changes are shared with the shell automatically. Auth, storage, toasts, dialogs, and modals are **not** in tiny - use the full SDK below.

## Install and init

```bash
npm install @shellui/sdk
```

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();
shellui.toast({ title: 'Hello from SDK', type: 'success' });
```

Opt out of automatic body padding from layout chrome:

```typescript
await shellui.init({ autoLayoutPadding: false });
```

`shellui.initialized` is `true` after a successful `init`. Check it before calling APIs from late-mounting code.

Concurrent `init()` calls share one in-flight promise (e.g. React StrictMode). **Only the first caller's options apply** — a second `init({ autoLayoutPadding: false })` while the first is still running is ignored. Await the first `init` (or check `initialized`) before relying on option overrides.

### Handshake (request-driven)

When embedded, `init()` posts `SHELLUI_SETTINGS_REQUESTED` and waits for `SHELLUI_SETTINGS`, then posts `SHELLUI_INITIALIZED`. The shell does **not** push messages into the iframe before that request — it only sets `iframe.src` from navigation and reacts. Layout chrome for the main frame arrives inside the settings payload; later chrome/settings updates go only to frames that have started the handshake.

Embedded companions automatically allow the parent shell origin (same as tiny), so cross-origin local dev (`localhost:4000` shell ↔ `localhost:5173` app) works without passing `allowedMessageOrigins`. Use that option only for extra hosts.

## Layout chrome (safe insets)

Floating layout publishes `layoutChrome` to the **main** content iframe only (not modals / drawers). The iframe stays 100% × 100%; padding is applied **inside** the app.

```typescript
await shellui.init();

const chrome = shellui.getLayoutChrome();
// { layout, viewport, insets, chromeVisible, autoPadding }

shellui.applyLayoutChrome();
shellui.applyLayoutChrome({ autoPadding: false });
```

CSS variables on `<html>`: `--shellui-inset-top`, `--shellui-inset-right`, `--shellui-inset-bottom`, `--shellui-inset-left`. Auto-padding adds `shellui-apply-layout-chrome-pad` on `document.body`. Apps with a fixed `#root` should put that class on the scroll content (or read the vars) so the frame stays full-bleed under translucent chrome.

The SDK watches capture-phase `window`/`document` scroll. For a nested overflow scroller, call:

```typescript
shellui.reportContentScroll({
  scrollY: scroller.scrollTop,
  direction: 'down',
});
```

## Host chrome from the iframe

### Floating chrome actions

Declare optional top/bottom action chrome owned by the shell (back, title, trailing, primary FAB):

```typescript
await shellui.init();

shellui.actions.set({
  back: { id: 'back', onClick: () => history.back() },
  title: 'Inbox',
  trailing: [
    { id: 'edit', label: 'Edit', onClick: () => {} },
    { id: 'share', label: 'Share', onClick: () => {} },
  ],
  primary: { id: 'compose', icon: 'plus', onClick: () => {} },
});

// Re-set or clear on your own SPA navigations — the shell does not infer routes.
shellui.actions.clear();
```

| Field      | Type                                                          | Notes                                         |
| ---------- | ------------------------------------------------------------- | --------------------------------------------- |
| `back`     | `{ id, label?, icon?, disabled?, animate?, onClick? }`        | Optional; max 1                               |
| `title`    | `string` \| `{ text: string }`                                | Optional; max 1                               |
| `trailing` | `Array<{ id, label?, icon?, disabled?, animate?, onClick? }>` | Optional; ≤8 kept, ≤3 visible (rest in `···`) |
| `primary`  | `{ id, label?, icon?, disabled?, animate?, onClick? }`        | Optional; max 1 bottom FAB                    |

Every action needs a non-empty `id`. Provide `label` and/or `icon` (`icon` may be a URL or a [built-in name](/features/chrome-actions#icons)).

Protocol: app → shell `SHELLUI_ACTIONS_SET` / `SHELLUI_ACTIONS_CLEAR`; shell → that iframe only `SHELLUI_ACTION` `{ id }` (SDK runs matching `onClick`). Types: `ChromeActionItem`, `ChromeActionsSpec`, `ChromeActionsPayload`.

SDK → shell messages use concrete target origins (parent shell origin). Inbound shell → iframe traffic is accepted only from allowed origins and trusted sources (registered iframe, parent, or same-window).

**Shellui host apps** — prefer `shellui.config.json` (unioned with navigation, storage, and admin URLs):

```json
{
  "security": {
    "allowedMessageOrigins": ["https://preview.example.com", "http://127.0.0.1:4173"]
  }
}
```

Each entry may be an absolute `http(s)` origin or URL; invalid values are skipped at boot.

**Standalone / embedded SDK** (non-Shellui host) — use init or runtime APIs:

```typescript
await shellui.init({
  allowedMessageOrigins: ['https://companion.example.com'],
});

shellui.configureMessageSecurity({
  allowedOrigins: ['https://companion.example.com'],
});
```

See [Floating chrome actions](/features/chrome-actions) for density caps, multi-view lifecycle, and Settings → Develop smoke buttons.

### Toasts

```typescript
const toastId = shellui.toast({
  title: 'File uploaded',
  type: 'success',
  action: {
    label: 'View',
    onClick: () => {
      shellui.navigate('/files');
    },
  },
});

shellui.toast({
  id: toastId,
  title: 'Upload complete',
  type: 'success',
});
```

See [Toasts](/features/toasts).

### Dialogs

```typescript
shellui.dialog({
  title: 'Delete item',
  description: 'This cannot be undone.',
  mode: 'okCancel',
  onOk: () => {
    void deleteItem();
  },
});
```

See [Dialogs](/features/dialogs).

### Modals and drawers

```typescript
shellui.openModal({
  url: 'https://example.com/form',
  size: 'lg',
  dynamicSizing: false,
  showCloseButton: true,
  dismissible: true,
  closeOnOverlayClick: true,
  movable: true,
  resizable: true,
});
shellui.closeModal();

shellui.openDrawer({
  url: '/filters',
  position: 'left',
  size: 'md',
  showDragHandle: true,
  resizable: true,
});
shellui.closeDrawer();
```

On viewports below 768px, every drawer `position` presents as a bottom sheet (same as mobile `openModal`). For content-sized overlays:

```typescript
await shellui.init();
shellui.overlay.autoSize({ observe: true });
shellui.overlay.reportSize({ height: 420 });
```

Message type `SHELLUI_OVERLAY_SIZE` with payload `{ version: 1, height, width?, overlayId? }`. See [Modals and drawers](/features/modals-drawers).

### Navigation and login

```typescript
shellui.navigate('/dashboard');
shellui.navigate('https://example.com/page');

shellui.login({
  method: 'oauth',
  provider: 'github',
  redirectPath: '/login',
});
```

Navigation applies to URLs configured in host navigation. `login` asks the **root** window to run OAuth so redirects are not trapped in the iframe. Methods: `oauth` (with `provider`) and `web3`.

### Storage

The SDK forwards file calls to the root shell, which uses `storage.url` and the session token. Methods return `{ data, error }` (they do not throw). See [Storage](/features/storage).

```typescript
await shellui.init();

const { data, error } = await shellui.storage
  .from('company')
  .upload('docs/reports/2024/q1.pdf', file, { upsert: true });

const { data: entries } = await shellui.storage.from('company').list('docs/reports');
```

Folders are path prefixes. `list()` returns folders with `id: null` and a `folder_id` when a placeholder exists. Pass `{ folder: true }` on `move` / `rename` to move a whole folder.

### On-device AI (Prompt API shape)

Embedded apps call a LanguageModel-shaped API. The shell owns Ollama / browser adapters - the SDK only postMessages. See [On-device AI](/features/ai).

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();

const availability = await shellui.ai.languageModel.availability();
if (availability === 'available') {
  const session = await shellui.ai.languageModel.create();
  const text = await session.prompt('Summarize this…');
  session.destroy();
}
```

### Storage picker

Open a modal so the user can pick folders, files, or both. Returns `{ items }` or `null` if cancelled.

```typescript
const folders = await shellui.selectFolders({ multiple: true });
const files = await shellui.selectFiles({ multiple: true, folders: true });
```

Each picked item includes a stable `id`. See [Storage picker](/features/storage-picker).

## Settings and messages

After `init`, listen for settings (appearance, language, user, token):

```typescript
shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', (data) => {
  const { settings } = data.payload as { settings?: Record<string, unknown> };
  const colorScheme = (settings as { appearance?: { colorScheme?: string } })?.appearance
    ?.colorScheme;
  void colorScheme;
});
```

Host `administration` is documented in [Administration](/features/administration). `settings.storage` and `shellui.storage` require `storage.url`. Settings → Storage is hidden when `showInSettings` is `false`.

```typescript
const cleanup = shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', (data) => {
  void data;
});
cleanup();

shellui.sendMessageToParent({
  type: 'CUSTOM_MESSAGE',
  payload: { data: 'value' },
});

shellui.sendMessage({
  type: 'CUSTOM_MESSAGE',
  payload: { data: 'value' },
  to: ['frame-uuid-1'],
});
```

Common types:

- `SHELLUI_URL_CHANGED`, `SHELLUI_SETTINGS`, `SHELLUI_SETTINGS_UPDATED`, `SHELLUI_SETTINGS_REQUESTED`
- `SHELLUI_OPEN_MODAL`, `SHELLUI_CLOSE_MODAL`, `SHELLUI_OPEN_DRAWER`, `SHELLUI_CLOSE_DRAWER`, `SHELLUI_OVERLAY_SIZE`
- `SHELLUI_NAVIGATE`, `SHELLUI_LOGIN`, `SHELLUI_INITIALIZED`
- `SHELLUI_STORAGE_REQUEST` / `SHELLUI_STORAGE_RESPONSE`
- `SHELLUI_SELECT_STORAGE` / `SHELLUI_SELECT_STORAGE_RESULT`
- `SHELLUI_AI_REQUEST` / `SHELLUI_AI_RESPONSE` / `SHELLUI_AI_STREAM`
- `SHELLUI_LAYOUT_CHROME`, `SHELLUI_CONTENT_SCROLL`

If you host nested iframes:

```typescript
const frameId = shellui.addIframe(iframe);
shellui.getUuidByIframe(iframe.contentWindow);
shellui.removeIframe(frameId);
```

## Logging and version

```typescript
import { getLogger, getVersion } from '@shellui/sdk';

const logger = getLogger('my-app');
logger.info('Application started');
const version = getVersion();
```

Namespaces: `'shellsdk'`, `'shellcore'`, plus names you pass to `getLogger`.

## API surface

**Chrome:** `init`, `actions.set` / `actions.clear`, `toast`, `dialog`, `openModal` / `closeModal`, `openDrawer` / `closeDrawer`, `overlay.reportSize` / `overlay.autoSize`, `navigate`, `login`, `getLayoutChrome`, `applyLayoutChrome`, `reportContentScroll`.

**Storage:** `storage`, `selectFolders`, `selectFiles`, `selectStorage`.

**AI:** `ai.languageModel` (`availability`, `create`, `prompt`, `promptStreaming`).

**Bus:** `addMessageListener`, `removeMessageListener`, `sendMessage`, `sendMessageToParent`, `propagateMessage`.

**Frames:** `addIframe`, `removeIframe`, `getUuidByIframe`.

**Utils:** `getLogger`, `getVersion` (also `shellui.getVersion()`).

Prefer TypeScript types from `@shellui/sdk` (`ToastOptions`, `DialogOptions`, `OpenModalOptions`, …). Remove message listeners when a component unmounts. Wrap async SDK calls in your own error handling.

## Related pages

- [Toasts](/features/toasts), [Dialogs](/features/dialogs), [Floating chrome actions](/features/chrome-actions), [Modals and drawers](/features/modals-drawers)
- [Storage](/features/storage), [Storage picker](/features/storage-picker), [On-device AI](/features/ai)
- [Navigation](/features/navigation)
- [Create a project - shell plus an iframe app](/quickstart#shell-plus-an-iframe-app)
