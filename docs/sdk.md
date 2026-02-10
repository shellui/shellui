# ShellUI SDK

The ShellUI SDK provides programmatic access to ShellUI features from your JavaScript/TypeScript code.

## Installation

```bash
npm install @shellui/sdk
```

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

Open URLs in modal overlays:

```javascript
// Open modal
shellui.openModal('/settings');

// Open external URL in modal
shellui.openModal('https://example.com/form');
```

### Drawers

Open URLs in drawer panels:

```javascript
// Open drawer (default: right, auto size)
shellui.openDrawer({
  url: '/sidebar',
});

// Open drawer with custom position and size
shellui.openDrawer({
  url: '/filters',
  position: 'left',
  size: '400px',
});

// Close drawer
shellui.closeDrawer();
```

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

## Message Passing

ShellUI uses a message passing system for communication between the shell and sub-apps (iframes).

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

Common ShellUI message types:

- `SHELLUI_URL_CHANGED` - URL changed in shell
- `SHELLUI_SETTINGS_UPDATED` - Settings were updated
- `SHELLUI_OPEN_MODAL` - Modal opened
- `SHELLUI_CLOSE_MODAL` - Modal closed
- `SHELLUI_OPEN_DRAWER` - Drawer opened
- `SHELLUI_CLOSE_DRAWER` - Drawer closed
- `SHELLUI_NAVIGATE` - Navigation requested
- `SHELLUI_INITIALIZED` - SDK initialized

## Settings Access

Access user settings:

```javascript
// Settings are available after initialization
// They're automatically synced from the shell

// Listen for settings updates
shellui.addMessageListener('SHELLUI_SETTINGS', (data) => {
  const { settings } = data.payload;
  console.log('Current settings:', settings);

  // Access specific settings
  const theme = settings.appearance?.theme;
  const language = settings.language?.code;
});
```

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

Use ShellUI's logger:

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
console.log(`ShellUI SDK version: ${version}`);
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
    applyTheme(settings.appearance?.theme);
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
- `shellui.openModal(url)` - Open modal
- `shellui.openDrawer(options)` - Open drawer
- `shellui.closeDrawer()` - Close drawer
- `shellui.navigate(url)` - Navigate programmatically

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
- [Navigation](/features/navigation) - Navigation configuration
