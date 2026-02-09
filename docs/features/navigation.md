# Navigation

ShellUI provides a flexible navigation system that supports icons, groups, localization, and multiple display modes.

## Basic Navigation

The simplest navigation configuration uses an array of navigation items:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: 'http://localhost:4000/',
      icon: '/icons/home.svg',
    },
    {
      label: 'About',
      path: 'about',
      url: 'https://example.com/about',
    },
  ],
};
```

### Navigation Item Properties

Each navigation item supports the following properties:

- **`label`** (string | LocalizedString, required): Display text for the navigation item
- **`path`** (string, required): Unique path identifier used in the URL (e.g., `/home`)
- **`url`** (string, required): URL to load when the navigation item is clicked
- **`icon`** (string, optional): Path to an SVG icon file (e.g., `/icons/home.svg`)

## Navigation Groups

Organize navigation items into groups with titles:

```typescript
const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Dashboard',
      path: 'dashboard',
      url: 'http://localhost:4000/',
    },
    {
      title: 'System',
      items: [
        {
          label: 'Settings',
          path: 'settings',
          url: 'http://localhost:4000/settings',
          icon: '/icons/settings.svg',
        },
        {
          label: 'Profile',
          path: 'profile',
          url: 'http://localhost:4000/profile',
        },
      ],
    },
  ],
};
```

Groups can have a `title` (string or localized) and an array of `items`. The group title appears as a section header in the sidebar.

## Localized Labels

Navigation labels and group titles can be localized for multi-language support:

```typescript
const config: ShellUIConfig = {
  language: ['en', 'fr'], // Enable English and French
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
      // Group with localized title
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

The label automatically updates based on the user's selected language. See the [Internationalization guide](/features/internationalization) for more details.

## Visibility Control

Control when navigation items are visible:

### Hidden Items

Hide items from the sidebar and 404 page (route remains valid):

```typescript
{
  label: 'Admin Panel',
  path: 'admin',
  url: '/admin',
  hidden: true, // Hidden from sidebar, but route still works
}
```

### Responsive Visibility

Hide items on specific screen sizes:

```typescript
{
  label: 'Desktop Only',
  path: 'desktop',
  url: '/desktop',
  hiddenOnMobile: true, // Hidden on mobile (bottom nav)
}

{
  label: 'Mobile Only',
  path: 'mobile',
  url: '/mobile',
  hiddenOnDesktop: true, // Hidden on desktop (sidebar)
}
```

**Note:** `hiddenOnMobile` and `hiddenOnDesktop` have no effect if `hidden` is `true`.

## Opening Modes

Control how navigation items open when clicked:

### Default Mode

Opens in the main content area (default behavior):

```typescript
{
  label: 'Home',
  path: 'home',
  url: '/',
  openIn: 'default', // Optional, this is the default
}
```

### Modal Mode

Opens the URL in a modal overlay:

```typescript
{
  label: 'Settings',
  path: 'settings',
  url: '/settings',
  openIn: 'modal',
}
```

The modal appears centered on the screen with a backdrop. Users can close it by clicking outside or pressing Escape.

### Drawer Mode

Opens the URL in a side drawer panel:

```typescript
{
  label: 'Sidebar',
  path: 'sidebar',
  url: '/sidebar',
  openIn: 'drawer',
  drawerPosition: 'right', // Optional, defaults to 'right'
}
```

**Drawer Positions:**
- `'top'` - Slides down from top
- `'bottom'` - Slides up from bottom
- `'left'` - Slides in from left
- `'right'` - Slides in from right (default)

### External Mode

Opens the URL in a new browser tab:

```typescript
{
  label: 'External Site',
  path: 'external',
  url: 'https://example.com',
  openIn: 'external',
}
```

This is equivalent to `target="_blank"` and opens the link in a new tab.

## Sidebar Positioning

Control where items appear in the sidebar:

```typescript
const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Top Item',
      path: 'top',
      url: '/',
      position: 'start', // Default, appears in main sidebar area
    },
    {
      label: 'Bottom Item',
      path: 'bottom',
      url: '/bottom',
      position: 'end', // Appears in sidebar footer
    },
    {
      title: 'Footer Group',
      position: 'end', // Group appears in sidebar footer
      items: [
        {
          label: 'Footer Item',
          path: 'footer',
          url: '/footer',
        },
      ],
    },
  ],
};
```

- **`'start'`** (default): Items appear in the main sidebar area
- **`'end'`**: Items appear in the sidebar footer (useful for settings, logout, etc.)

## Complete Example

Here's a complete navigation configuration showcasing all features:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  language: ['en', 'fr'],
  navigation: [
    {
      label: 'Dashboard',
      path: 'dashboard',
      url: 'http://localhost:4000/',
      icon: '/icons/dashboard.svg',
    },
    {
      label: {
        en: 'Documentation',
        fr: 'Documentation',
      },
      path: 'docs',
      url: 'https://docs.example.com',
      icon: '/icons/book.svg',
    },
    {
      label: 'External Link',
      path: 'external',
      url: 'https://example.com',
      openIn: 'external',
    },
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
      openIn: 'modal',
      position: 'end',
    },
    {
      label: 'Side Panel',
      path: 'panel',
      url: '/panel',
      openIn: 'drawer',
      drawerPosition: 'right',
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
          label: 'Hidden Route',
          path: 'hidden',
          url: '/hidden',
          hidden: true, // Not shown in sidebar
        },
      ],
    },
    {
      label: 'Mobile Only',
      path: 'mobile',
      url: '/mobile',
      hiddenOnDesktop: true,
    },
  ],
};

export default config;
```

## Best Practices

1. **Use icons**: Add SVG icons to make navigation more visual and easier to scan
2. **Group related items**: Use navigation groups to organize related functionality
3. **Localize labels**: Use localized strings when building multi-language apps
4. **Use appropriate open modes**: 
   - Use `modal` for settings or quick actions
   - Use `drawer` for secondary content or sidebars
   - Use `external` for links to other sites
5. **Position important items**: Place frequently used items at the top (`position: 'start'`) and system items at the bottom (`position: 'end'`)

## Related Guides

- [Layouts](/features/layouts) - Learn about different layout modes
- [Internationalization](/features/internationalization) - Multi-language support
- [Modals & Drawers](/features/modals-drawers) - Detailed guide on overlay modes
