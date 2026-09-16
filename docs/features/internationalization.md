---
title: Localize the shell
sidebar_label: Internationalization
description: 'Enable en and fr, localize navigation labels, and let users pick a language in Settings.'
---

Set `language` to one code or an array. Built-in UI strings exist for `'en'` (English) and `'fr'` (French). If `language` is omitted, the shell defaults to `'en'`.

```json
{
  "language": ["en", "fr"]
}
```

A single string (`"en"`) enables only that language. Users change the active language in **Settings → Language**. The choice is stored in user settings and drives navigation labels (when localized), chrome copy, Settings, and error messages.

## LocalizedString

```typescript
type LocalizedString =
  | string
  | {
      en: string;
      fr: string;
      [key: string]: string;
    };
```

Supported on navigation item `label`, group `title`, administration titles/labels, and cookie-consent `description`. A plain string is shown in every language.

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  language: ['en', 'fr'],
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: '/',
    },
    {
      label: {
        en: 'Settings',
        fr: 'Paramètres',
      },
      path: 'settings',
      url: '/settings',
    },
    {
      title: {
        en: 'System',
        fr: 'Système',
      },
      items: [
        {
          label: {
            en: 'Profile',
            fr: 'Profil',
          },
          path: 'profile',
          url: '/profile',
        },
      ],
    },
  ],
};
```

Iframe apps should listen for SDK `language` / `SHELLUI_SETTINGS` and update their own copy. Do not ship a second locale picker unless that app **is** the language settings surface. The shell already owns locale. JS starters from `shellui init` do this with `@shellui/sdk/tiny` - see [Framework starters](/framework-starters#theme-and-i18n-out-of-the-box).

Provide a translation for every enabled code when you use an object. Extra keys on `LocalizedString` are allowed in the type; chrome translations beyond `en` / `fr` are not shipped in core today. Layouts are LTR.

## Related pages

- [Framework starters](/framework-starters), [Navigation](/features/navigation), [Cookie consent](/features/cookie-consent), [SDK](/sdk)
