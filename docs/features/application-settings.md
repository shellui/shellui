# Application Settings

Navigation items can expose their own settings panels that appear in **Settings > Applications**. Each application provides a URL to its settings page; Shellui embeds it in the settings view.

## Overview

When you add a `settings` URL to a navigation item, that application appears under **Settings > Applications** (listed first in the settings sidebar). Users can access each app's settings without leaving the main Shellui settings view.

## Configuration

Add the `settings` property to any navigation item:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Playground',
      path: 'playground',
      url: '/',
      icon: '/icons/play.svg',
      settings: '/__settings',
    },
    {
      label: {
        en: 'Docs',
        fr: 'Documentation',
      },
      path: 'docs',
      url: 'http://localhost:3000',
      icon: '/icons/book-open.svg',
      settings: 'http://localhost:3000/settings',
    },
  ],
};
```

## Implementation Requirements

Your settings page is embedded via an iframe (ContentView). To integrate well with the Shellui shell, follow these practices:

### Theme and Styling

Provide a URL that follows the **Shellui SDK** and **theme** conventions. Your settings page should:

- Use the same theme (light/dark) as the shell
- Respect the shell's color scheme for a consistent look

Shellui does not inject styles into your iframe. Your settings page must apply its own theming in a way that matches the shell—for example, by using CSS variables exposed by the shell or by implementing a matching design system.

### Internationalization (i18n)

Follow **i18n best practices** for your settings UI:

- Use localized strings for labels, descriptions, and options
- Detect the user's language (e.g., from the shell or browser)
- Support the same languages enabled in the Shellui configuration

The navigation item's localized `label` is used in the settings sidebar; your settings page content is entirely under your control.

### Storage

**Shellui is not aware of application settings data.** Each application must manage its own settings storage independently.

- Store settings in **localStorage** (or another storage mechanism) under keys you control
- Use a unique prefix or namespace to avoid collisions with Shellui or other apps
- Shellui stores its own settings (theme, language, etc.) separately

Example pattern:

```javascript
const STORAGE_KEY = 'myapp-settings';

function loadSettings() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored
    ? JSON.parse(stored)
    : {
        /* defaults */
      };
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
```

## Behavior

- **Applications group**: Items with `settings` appear under Settings > Applications, first in the sidebar
- **Label and icon**: The nav item's `label` (including localized variants) and optional `icon` are used for display
- **Embedding**: The settings URL is loaded in a ContentView iframe, with the same integration as main content iframes
- **Isolation**: Your settings page runs in its own context; storage and state are independent of Shellui

## Related Guides

- [Navigation](/features/navigation) - Navigation item configuration
- [Themes](/features/themes) - Shellui theming
- [Internationalization](/features/internationalization) - Multi-language support
- [SDK Reference](/sdk) - Shellui SDK integration
- [Storage](/features/storage) - Settings → Storage quota (only when `storage` is configured)
