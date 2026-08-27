# Shellui SDK

The Shellui SDK provides programmatic access to Shellui features from your JavaScript/TypeScript code.

## Installation

```bash
npm install @shellui/sdk
```

## Tiny injectable (external sites)

For pages that only need **theme**, **language/region**, and **navigation sync**, use the tiny CDN script (`shellui.tiny.js`, ~2 KB min / ~1 KB gzip). It auto-handshakes on load — no `init()` required.

```html
<script
  src="https://cdn.jsdelivr.net/npm/@shellui/sdk/dist/shellui.tiny.js"
  async
></script>
<script>
  shellui.ready.then(() => {
    console.log(shellui.theme?.mode, shellui.language, shellui.region?.timezone);
    shellui.applyTheme();
  });

  shellui.on('theme', () => shellui.applyTheme());
  shellui.navigate('/dashboard');
</script>
```

Or via the package subpath:

```js
import shellui from '@shellui/sdk/tiny';

await shellui.ready;
shellui.applyTheme();
```

| Member            | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| `ready`           | Promise resolved after handshake (or immediately outside an iframe)  |
| `initialized`     | `boolean`                                                            |
| `theme`           | Theme snapshot (`mode`, `colorScheme`, `colors`, fonts, …) or `null` |
| `language`        | Language code (e.g. `"en"`) or `null`                                |
| `region`          | `{ timezone }` or `null`                                             |
| `on(event, cb)`   | `'ready'`, `'theme'`, `'language'`, `'region'` — returns unsubscribe |
| `navigate(url)`   | Ask the shell to navigate                                            |
| `applyTheme(el?)` | Write CSS variables on `el` (default `<html>`) and toggle `dark`     |

URL changes are shared with the shell automatically. Auth, storage, toasts, dialogs, and modals are **not** included — use the full SDK below for those.

## Quick Start

```javascript
import { shellui } from '@shellui/sdk';

// Initialize the SDK
await shellui.init();

// Use SDK features
shellui.toast({
  title: 'Hello from SDK!',
  type: 'success',
});
```

## Initialization

### Basic Initialization

```javascript
import { shellui } from '@shellui/sdk';

// Initialize SDK (required before using other features)
await shellui.init();
```

The SDK automatically detects if it's running in an iframe (sub-app) or the root window and handles communication accordingly.

### Check Initialization Status

```javascript
if (shellui.initialized) {
  // SDK is ready
  shellui.toast({ title: 'SDK Ready' });
}
```

## Core Functions

### Toast Notifications

Show toast notifications:

```javascript
import { shellui } from '@shellui/sdk';

// Simple toast
shellui.toast({
  title: 'Success!',
  description: 'Operation completed.',
  type: 'success',
});

// Toast with action
const toastId = shellui.toast({
  title: 'File uploaded',
  action: {
    label: 'View',
    onClick: () => {
      console.log('View clicked');
    },
  },
});

// Update toast
shellui.toast({
  id: toastId,
  title: 'Upload complete!',
  type: 'success',
});
```

See the [Toast Notifications guide](/features/toasts) for complete details.

### Alert Dialogs

Show alert dialogs:

```javascript
shellui.dialog({
  title: 'Confirm Delete',
  description: 'Are you sure you want to delete this item?',
  mode: 'okCancel',
  onOk: () => {
    console.log('Confirmed');
  },
  onCancel: () => {
    console.log('Cancelled');
  },
});
```

See the [Alert Dialogs guide](/features/dialogs) for complete details.

### Modals

Open URLs in modal overlays (desktop: centered dialog; mobile: bottom drawer):

```javascript
// Simple
shellui.openModal('/settings');

// Options
shellui.openModal({
  url: 'https://example.com/form',
  size: 'lg', // sm | md | lg | xl | full | content
  showCloseButton: true,
  dismissible: true,
  closeOnOverlayClick: true,
  movable: true, // default — drag top edge (desktop/tablet)
  resizable: true, // default — resize edges/corners (desktop/tablet)
});

shellui.closeModal();
```

### Drawers

Open URLs in drawer panels:

```javascript
shellui.openDrawer({
  url: '/sidebar',
});

shellui.openDrawer({
  url: '/filters',
  position: 'left',
  size: 'md', // preset or CSS length e.g. '400px'
  showCloseButton: true,
  showDragHandle: true,
  dismissible: true,
  closeOnOverlayClick: true,
  resizable: true, // default on desktop — drag free edge; not movable
});

shellui.closeDrawer();
```

### Overlay auto-size (iframe → shell)

When the overlay is opened with `size: 'content'`, the iframe reports its height over the message bus:

```javascript
await shellui.init();

// Observe document size and report (ResizeObserver)
shellui.overlay.autoSize({ observe: true });

// Or one-shot
shellui.overlay.reportSize({ height: 420 });
```

Message type: `SHELLUI_OVERLAY_SIZE` with payload `{ version: 1, height, width?, overlayId? }`.
See the [Modals & Drawers guide](/features/modals-drawers) for the full contract and fallback behavior.

See the [Modals & Drawers guide](/features/modals-drawers) for complete details.

### Navigation

Navigate programmatically:

```javascript
// Navigate to a route
shellui.navigate('/dashboard');

// Navigate to external URL (if configured in navigation)
shellui.navigate('https://example.com/page');
```

**Note:** Navigation only works for URLs configured in your navigation configuration.

### Login (iframe-safe OAuth)

Request login from the shell (root window). This is useful when your page runs in an iframe and OAuth redirects must happen from the top-level frame.

```javascript
shellui.login({
  method: 'oauth',
  provider: 'github',
  redirectPath: '/login', // optional, defaults to shell login route
});
```

### Storage (files)

Upload, download, list, move, and rename files from an iframe app. The SDK forwards the request to the root shell, which calls storage-service using `storage.url` from `shellui.config.json`. See [Storage](/features/storage) for the full API.

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

const { data, error } = await shellui.storage
  .from('company')
  .upload('docs/reports/2024/q1.pdf', file, { upsert: true });

const { data: entries } = await shellui.storage.from('company').list('docs/reports');
```

Folders are path prefixes. `list()` returns folders with `id: null` and a `folder_id` when a placeholder exists. Use `{ folder: true }` on `move` / `rename` to move a whole folder.

### Storage picker

Open a modal so the user can pick folders, files, or both. Returns `{ items }` or `null` if cancelled.

```javascript
const folders = await shellui.selectFolders({ multiple: true });
if (folders) {
  console.log(folders.items);
}

const files = await shellui.selectFiles({ multiple: true, folders: true });
```

Each item includes a stable `id` (keep this so a rename still points at the same folder or file). See [Storage picker](/features/storage-picker).

## Message Passing

Shellui uses a message passing system for communication between the shell and sub-apps (iframes).

### Listening for Messages

```javascript
// Listen for a specific message type
const cleanup = shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', (data) => {
  const { settings } = data.payload;
  console.log('Settings updated:', settings);
  // Update your app based on new settings
});

// Clean up listener when done
cleanup();
```

### Sending Messages

```javascript
// Send message to parent (if in iframe)
shellui.sendMessageToParent({
  type: 'CUSTOM_MESSAGE',
  payload: { data: 'value' },
});

// Send message to all frames
shellui.sendMessage({
  type: 'CUSTOM_MESSAGE',
  payload: { data: 'value' },
});

// Send message to specific frame
shellui.sendMessage({
  type: 'CUSTOM_MESSAGE',
  payload: { data: 'value' },
  to: ['frame-uuid-1', 'frame-uuid-2'],
});
```

### Message Types

Common Shellui message types:

- `SHELLUI_URL_CHANGED` - URL changed in shell
- `SHELLUI_SETTINGS_UPDATED` - Settings were updated
- `SHELLUI_OPEN_MODAL` - Modal opened
- `SHELLUI_CLOSE_MODAL` - Modal closed
- `SHELLUI_OPEN_DRAWER` - Drawer opened
- `SHELLUI_CLOSE_DRAWER` - Drawer closed
- `SHELLUI_OVERLAY_SIZE` - Iframe content size report for content-sized overlays
- `SHELLUI_NAVIGATE` - Navigation requested
- `SHELLUI_LOGIN` - Login requested from iframe (minimal payload: method, provider, optional redirectPath)
- `SHELLUI_INITIALIZED` - SDK initialized
- `SHELLUI_STORAGE_REQUEST` / `SHELLUI_STORAGE_RESPONSE` - File API (handled by the root shell)
- `SHELLUI_SELECT_STORAGE` / `SHELLUI_SELECT_STORAGE_RESULT` - Storage picker (handled by the root shell)

## Settings Access

Access user settings:

```javascript
// Settings are available after initialization
// They're automatically synced from the shell

// Listen for settings updates
shellui.addMessageListener('SHELLUI_SETTINGS', (data) => {
  const { settings } = data.payload;
  console.log('Current settings:', settings);

  // Access specific settings (appearance has full theme values: name, colorScheme, mode, colors, etc.)
  const colorScheme = settings.appearance?.colorScheme;
  const themeValues = settings.appearance;
  const language = settings.language?.code;
  // Staff admin custom nav (from host `administration` config); null when unset
  const adminNav = settings.administration;
});
```

Host `administration` navigation is documented in [Administration panel](/features/administration). Host `storage` and `shellui.storage` are documented in [Storage](/features/storage); Settings → Storage is only shown when `storage.url` is set and `showInSettings` is not `false`.

## Frame Management

If you're working with iframes:

```javascript
// Add an iframe to the registry
const iframe = document.createElement('iframe');
iframe.src = '/sub-app';
const frameId = shellui.addIframe(iframe);

// Get frame UUID by window reference
const uuid = shellui.getUuidByIframe(iframe.contentWindow);

// Remove iframe
shellui.removeIframe(frameId);
// or
shellui.removeIframe(iframe);
```

## Logging

Use Shellui's logger:

```javascript
import { getLogger } from '@shellui/sdk';

const logger = getLogger('my-app');

logger.info('Application started');
logger.warn('Deprecated feature used');
logger.error('Error occurred', { error });
logger.debug('Debug information', { data });
```

Logger namespaces:

- `'shellsdk'` - SDK logging
- `'shellcore'` - Core logging
- Custom namespaces for your app

## Version Information

Get SDK version:

```javascript
import { getVersion } from '@shellui/sdk';

const version = getVersion();
console.log(`Shellui SDK version: ${version}`);
```

## Complete Example

Here's a complete example integrating multiple SDK features:

```javascript
import { shellui, getLogger } from '@shellui/sdk';

const logger = getLogger('my-app');

async function initializeApp() {
  // Initialize SDK
  await shellui.init();
  logger.info('SDK initialized');

  // Listen for settings updates
  shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', (data) => {
    const { settings } = data.payload;
    applyTheme(settings.appearance?.colorScheme);
    applyLanguage(settings.language?.code);
  });

  // Listen for URL changes
  shellui.addMessageListener('SHELLUI_URL_CHANGED', (data) => {
    const { pathname } = data.payload;
    logger.info('URL changed:', pathname);
    updateActiveRoute(pathname);
  });

  // Show welcome toast
  shellui.toast({
    title: 'Welcome!',
    description: 'Application loaded successfully.',
    type: 'success',
  });
}

function handleDelete(itemId) {
  shellui.dialog({
    title: 'Delete Item',
    description: 'Are you sure you want to delete this item?',
    mode: 'delete',
    onOk: async () => {
      try {
        await deleteItem(itemId);
        shellui.toast({
          title: 'Item deleted',
          type: 'success',
        });
      } catch (error) {
        shellui.toast({
          title: 'Failed to delete',
          description: error.message,
          type: 'error',
        });
      }
    },
    onCancel: () => {
      // User cancelled
    },
  });
}

function openSettings() {
  shellui.openModal('/settings');
}

function openFilters() {
  shellui.openDrawer({
    url: '/filters',
    position: 'left',
    size: '400px',
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
```

## TypeScript Support

The SDK includes TypeScript definitions:

```typescript
import { shellui, ToastOptions, DialogOptions } from '@shellui/sdk';

const toastOptions: ToastOptions = {
  title: 'Hello',
  type: 'success',
};

shellui.toast(toastOptions);

const dialogOptions: DialogOptions = {
  title: 'Confirm',
  mode: 'okCancel',
  onOk: () => {},
  onCancel: () => {},
};

shellui.dialog(dialogOptions);
```

## API Reference

### Core Functions

- `shellui.init()` - Initialize the SDK
- `shellui.getVersion()` - Get SDK version
- `shellui.toast(options)` - Show toast notification
- `shellui.dialog(options)` - Show alert dialog
- `shellui.openModal(url | options)` - Open modal (responsive dialog / mobile drawer)
- `shellui.closeModal()` - Close modal
- `shellui.openDrawer(options)` - Open drawer
- `shellui.closeDrawer()` - Close drawer
- `shellui.overlay.reportSize({ height })` - Report iframe content size
- `shellui.overlay.autoSize({ observe })` - Observe and report content size
- `shellui.navigate(url)` - Navigate programmatically
- `shellui.login(options)` - Request root-shell login
- `shellui.storage` - File API (`from(bucket).upload`, `download`, `list`, `move`, `rename`, …)
- `shellui.selectFolders(options)` - Open a folder picker modal
- `shellui.selectFiles(options)` - Open a file picker modal (`{ folders: true }` also allows folders)

### Message Functions

- `shellui.addMessageListener(type, listener)` - Add message listener
- `shellui.removeMessageListener(type, listener)` - Remove message listener
- `shellui.sendMessage(message)` - Send message to all frames
- `shellui.sendMessageToParent(message)` - Send message to parent
- `shellui.propagateMessage(message)` - Propagate message to all frames

### Frame Functions

- `shellui.addIframe(iframe)` - Add iframe to registry
- `shellui.removeIframe(identifier)` - Remove iframe
- `shellui.getUuidByIframe(windowRef)` - Get frame UUID

### Utility Functions

- `getLogger(namespace)` - Get logger instance
- `getVersion()` - Get SDK version

## Best Practices

1. **Always initialize**: Call `shellui.init()` before using other features
2. **Clean up listeners**: Remove message listeners when components unmount
3. **Handle errors**: Wrap SDK calls in try-catch blocks
4. **Check context**: Verify you're in the right context (iframe vs root) if needed
5. **Use TypeScript**: Take advantage of TypeScript definitions for type safety

## Related Guides

- [Toast Notifications](/features/toasts) - Detailed toast guide
- [Alert Dialogs](/features/dialogs) - Detailed dialog guide
- [Modals & Drawers](/features/modals-drawers) - Modal and drawer guide
- [Storage](/features/storage) - File API (`shellui.storage`) and Settings → Storage
- [Storage picker](/features/storage-picker) - Pick files and folders from an iframe app
- [Navigation](/features/navigation) - Navigation configuration
