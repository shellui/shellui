---
title: Add application settings panels
sidebar_label: Application Settings
description: Set navigation[].settings so an iframe panel appears under Settings → Applications.
---

A navigation item with a `settings` URL appears under **Settings → Applications** (first group in the settings sidebar). The shell embeds that URL in an iframe. You keep your own settings storage; the host does not read those keys.

```typescript
import type { ShellUIConfig } from "@shellui/core";

const config: ShellUIConfig = {
  navigation: [
    {
      label: "Playground",
      path: "playground",
      url: "/",
      icon: "/icons/play.svg",
      settings: "/__settings",
    },
    {
      label: {
        en: "Docs",
        fr: "Documentation",
      },
      path: "docs",
      url: "http://localhost:3000",
      icon: "/icons/book-open.svg",
      settings: "http://localhost:3000/settings",
    },
  ],
};
```

The sidebar uses the item's `label` (including localized variants) and optional `icon`. The iframe gets the same SDK handshake as main content: call `init`, apply theme from `settings.appearance`, and listen for `language`. Do not inject a second theme picker unless this panel **is** the appearance UI.

Store app settings under a namespaced key you control (for example `myapp-settings` in `localStorage`). Shellui stores theme, language, and related host settings separately.

The panel runs in its own context. Isolation is the point: collisions with host keys are your problem to avoid with a prefix.

## Related pages

- [Navigation](/features/navigation), [Themes](/features/themes), [Internationalization](/features/internationalization), [SDK](/sdk)
