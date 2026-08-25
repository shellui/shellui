# SDK

## Full SDK (embedded apps)

```bash
npm i @shellui/sdk
```

```js
import { shellui } from '@shellui/sdk';
await shellui.init(); // required first

shellui.toast({ title: 'Saved', type: 'success' });
shellui.dialog({ title: 'Delete?', mode: 'okCancel', onOk: () => {} });
shellui.openModal('/settings');
shellui.openDrawer({ url: '/filters', position: 'right', size: '400px' });
shellui.closeDrawer();
shellui.navigate('/dashboard');
shellui.login({ method: 'oauth', provider: 'github' }); // iframe-safe
```

**Rule:** drawers, modals, toasts, dialogs → SDK. Do not duplicate shell chrome in the iframe.

Also: storage (`shellui.storage`), pickers (`selectFiles` / `selectFolders`). Details: https://docs.shellui.com/sdk

## Tiny (theme / language / nav only)

```js
import shellui from '@shellui/sdk/tiny';
await shellui.ready;
shellui.applyTheme();
shellui.on('theme', () => shellui.applyTheme());
shellui.navigate('/dashboard');
```

CDN: `https://cdn.jsdelivr.net/npm/@shellui/sdk/dist/shellui.tiny.js` (sets `window.shellui`).

**Not in tiny:** auth, storage, toast, dialog, modal, drawer.

## Windows layout

`layout: 'windows'` is shell config (experimental). Child apps still use the SDK for overlays; do not build a parallel windowing UI in the iframe.
