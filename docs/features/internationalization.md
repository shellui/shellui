# Internationalization

ShellUI supports multi-language applications with localized navigation labels, UI text, and user preferences.

## Enabling Languages

Enable languages in your configuration by specifying language codes:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  language: 'en', // Single language
  // or
  language: ['en', 'fr'], // Multiple languages
  // ... rest of config
};
```

**Supported Languages:**
- `'en'` - English
- `'fr'` - French

## Localized Navigation Labels

Navigation labels can be localized using an object with language keys:

```typescript
const config: ShellUIConfig = {
  language: ['en', 'fr'],
  navigation: [
    {
      // Simple string (backward compatible)
      label: 'Home',
      path: 'home',
      url: '/',
    },
    {
      // Localized label object
      label: {
        en: 'Documentation',
        fr: 'Documentation',
      },
      path: 'docs',
      url: '/docs',
    },
    {
      label: {
        en: 'Settings',
        fr: 'Paramètres',
      },
      path: 'settings',
      url: '/settings',
    },
  ],
};
```

The label automatically displays in the user's selected language.

## Localized Group Titles

Navigation group titles can also be localized:

```typescript
const config: ShellUIConfig = {
  language: ['en', 'fr'],
  navigation: [
    {
      title: {
        en: 'System',
        fr: 'Système',
      },
      items: [
        {
          label: {
            en: 'Settings',
            fr: 'Paramètres',
          },
          path: 'settings',
          url: '/settings',
        },
      ],
    },
  ],
};
```

## Mixed Localization

You can mix localized and non-localized labels:

```typescript
const config: ShellUIConfig = {
  language: ['en', 'fr'],
  navigation: [
    {
      // Non-localized (always shows "Home")
      label: 'Home',
      path: 'home',
      url: '/',
    },
    {
      // Localized (shows "Documentation" or "Documentation" based on language)
      label: {
        en: 'Documentation',
        fr: 'Documentation',
      },
      path: 'docs',
      url: '/docs',
    },
  ],
};
```

## Language Configuration

### Single Language

Enable only one language:

```typescript
const config: ShellUIConfig = {
  language: 'en', // Only English
  // ... rest of config
};
```

### Multiple Languages

Enable multiple languages:

```typescript
const config: ShellUIConfig = {
  language: ['en', 'fr'], // English and French
  // ... rest of config
};
```

### Language Detection

If `language` is not specified, ShellUI defaults to English (`'en'`).

## User Language Selection

Users can change their language preference in Settings > Language. The selection is stored in user settings and persists across sessions.

The language preference affects:
- Navigation labels (if localized)
- UI text (buttons, labels, etc.)
- Settings interface
- Error messages

## Localized Strings in Configuration

Any string property that supports `LocalizedString` can be localized:

```typescript
type LocalizedString =
  | string
  | {
      en: string;
      fr: string;
      [key: string]: string; // Other language codes
    };
```

**Supported Properties:**
- Navigation item `label`
- Navigation group `title`
- Cookie consent descriptions (see [Cookie Consent](/features/cookie-consent))

## Complete Example

Here's a complete example with localized navigation:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  language: ['en', 'fr'],
  title: 'My App',
  navigation: [
    {
      label: {
        en: 'Dashboard',
        fr: 'Tableau de bord',
      },
      path: 'dashboard',
      url: '/',
      icon: '/icons/dashboard.svg',
    },
    {
      label: {
        en: 'Documentation',
        fr: 'Documentation',
      },
      path: 'docs',
      url: '/docs',
      icon: '/icons/book.svg',
    },
    {
      title: {
        en: 'System',
        fr: 'Système',
      },
      items: [
        {
          label: {
            en: 'Settings',
            fr: 'Paramètres',
          },
          path: 'settings',
          url: '/settings',
          icon: '/icons/settings.svg',
        },
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

export default config;
```

## Language Switching

Users can switch languages through:

1. **Settings UI**: Settings > Language > Select language
2. **Programmatic**: The language preference is stored in settings and can be accessed via the SDK

## Best Practices

1. **Always provide fallbacks**: Use simple strings for labels that don't need translation
2. **Consistent keys**: Use consistent language keys across your configuration
3. **Complete translations**: Provide translations for all enabled languages
4. **Test both languages**: Test your application in all enabled languages
5. **Consider RTL**: While ShellUI currently supports LTR languages, consider future RTL support when designing layouts

## Language Codes

Use standard ISO 639-1 language codes:
- `'en'` - English
- `'fr'` - French
- Additional languages can be added by extending the language object

## Related Guides

- [Navigation](/features/navigation) - Learn about localized navigation labels
- [Cookie Consent](/features/cookie-consent) - Localized cookie descriptions
- [Themes](/features/themes) - Combine internationalization with custom themes
