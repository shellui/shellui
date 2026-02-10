# Themes

ShellUI supports custom themes with light/dark mode variants, custom fonts, and extensive color customization.

## Default Themes

ShellUI comes with built-in light and dark themes. Users can switch between them in Settings > Appearance.

## Custom Themes

Create custom themes by defining them in your configuration:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  themes: [
    {
      name: 'my-theme',
      displayName: 'My Custom Theme',
      colors: {
        light: {
          // Light mode colors
          background: '#ffffff',
          foreground: '#000000',
          // ... more colors
        },
        dark: {
          // Dark mode colors
          background: '#000000',
          foreground: '#ffffff',
          // ... more colors
        },
      },
    },
  ],
  defaultTheme: 'my-theme', // Optional: set as default
};
```

## Theme Structure

A theme definition includes:

- **`name`** (string, required): Unique identifier for the theme
- **`displayName`** (string, required): Human-readable name shown in settings
- **`colors`** (ThemeColors, required): Color definitions for light and dark modes
- **`fontFamily`** (string, optional): Global font family (backward compatible)
- **`headingFontFamily`** (string, optional): Font family for headings (h1-h6)
- **`bodyFontFamily`** (string, optional): Font family for body text
- **`fontFiles`** (string[], optional): URLs or paths to font files (e.g., Google Fonts)
- **`letterSpacing`** (string, optional): Custom letter spacing (e.g., "0.02em")
- **`textShadow`** (string, optional): Custom text shadow (e.g., "1px 1px 2px rgba(0, 0, 0, 0.1)")
- **`lineHeight`** (string, optional): Custom line height (e.g., "1.6")

## Color Palette

Each theme defines colors for both light and dark modes. Here's the complete color structure:

```typescript
colors: {
  light: {
    background: string;           // Main background color
    foreground: string;           // Main text color
    card: string;               // Card/surface background
    cardForeground: string;      // Card text color
    popover: string;            // Popover background
    popoverForeground: string;  // Popover text
    primary: string;            // Primary brand color
    primaryForeground: string;  // Text on primary
    secondary: string;          // Secondary color
    secondaryForeground: string; // Text on secondary
    muted: string;              // Muted background
    mutedForeground: string;    // Muted text
    accent: string;            // Accent color
    accentForeground: string;  // Text on accent
    destructive: string;       // Error/destructive color
    destructiveForeground: string; // Text on destructive
    border: string;            // Border color
    input: string;             // Input border color
    ring: string;              // Focus ring color
    radius: string;            // Border radius (e.g., "0.5rem")
    // Sidebar-specific colors
    sidebarBackground: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    sidebarRing: string;
  },
  dark: {
    // Same structure as light mode
  },
}
```

## Custom Fonts

### Google Fonts

Load fonts from Google Fonts:

```typescript
themes: [
  {
    name: 'custom-fonts',
    displayName: 'Custom Fonts Theme',
    fontFiles: [
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@700&display=swap',
    ],
    headingFontFamily: '"Playfair Display", serif',
    bodyFontFamily: '"Inter", system-ui, sans-serif',
    colors: {
      // ... colors
    },
  },
];
```

### Local Fonts

Use local font files:

```typescript
themes: [
  {
    name: 'local-fonts',
    displayName: 'Local Fonts Theme',
    fontFiles: ['/fonts/custom-font.woff2'],
    fontFamily: '"Custom Font", sans-serif',
    colors: {
      // ... colors
    },
  },
];
```

### Typography Settings

Customize typography beyond fonts:

```typescript
themes: [
  {
    name: 'typography-theme',
    displayName: 'Typography Theme',
    headingFontFamily: '"Georgia", serif',
    bodyFontFamily: '"Helvetica", sans-serif',
    lineHeight: '1.6',
    letterSpacing: '0.01em',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)',
    colors: {
      // ... colors
    },
  },
];
```

## Complete Theme Example

Here's a complete example with all theme features:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  themes: [
    {
      name: 'brand-theme',
      displayName: 'Brand Theme',
      // Load Google Fonts
      fontFiles: [
        'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Source+Serif+Pro:wght@400;600;700&display=swap',
      ],
      // Serif for headings, sans-serif for body
      headingFontFamily: '"Source Serif Pro", Georgia, serif',
      bodyFontFamily: '"Open Sans", system-ui, sans-serif',
      lineHeight: '1.6',
      letterSpacing: '0.01em',
      colors: {
        light: {
          background: '#F8F5F2',
          foreground: '#202124',
          card: '#F2EDEA',
          cardForeground: '#202124',
          popover: '#F2EDEA',
          popoverForeground: '#202124',
          primary: '#1F1D1D',
          primaryForeground: '#E8EAED',
          secondary: '#A37200',
          secondaryForeground: '#FFF9EB',
          muted: '#F2EDEA',
          mutedForeground: '#5F5959',
          accent: '#DBB778',
          accentForeground: '#202124',
          destructive: '#DC2626',
          destructiveForeground: '#FFFFFF',
          border: '#D7D5D5',
          input: '#D7D5D5',
          ring: '#A37200',
          radius: '0.375rem',
          sidebarBackground: '#F2EDEA',
          sidebarForeground: '#202124',
          sidebarPrimary: '#1F1D1D',
          sidebarPrimaryForeground: '#E8EAED',
          sidebarAccent: '#F8F5F2',
          sidebarAccentForeground: '#202124',
          sidebarBorder: '#D7D5D5',
          sidebarRing: '#A37200',
        },
        dark: {
          background: '#1F1D1D',
          foreground: '#E8EAED',
          card: '#2A2828',
          cardForeground: '#E8EAED',
          popover: '#2A2828',
          popoverForeground: '#E8EAED',
          primary: '#DBB778',
          primaryForeground: '#202124',
          secondary: '#A37200',
          secondaryForeground: '#FFF9EB',
          muted: '#2A2828',
          mutedForeground: '#9C9696',
          accent: '#A37200',
          accentForeground: '#FFF9EB',
          destructive: '#EF4444',
          destructiveForeground: '#FFFFFF',
          border: '#3F3B3B',
          input: '#3F3B3B',
          ring: '#DBB778',
          radius: '0.375rem',
          sidebarBackground: '#1F1D1D',
          sidebarForeground: '#E8EAED',
          sidebarPrimary: '#DBB778',
          sidebarPrimaryForeground: '#202124',
          sidebarAccent: '#2A2828',
          sidebarAccentForeground: '#E8EAED',
          sidebarBorder: '#2A2828',
          sidebarRing: '#DBB778',
        },
      },
    },
  ],
  defaultTheme: 'brand-theme', // Set as default theme
};
```

## Setting Default Theme

Set a default theme that users see on first visit:

```typescript
const config: ShellUIConfig = {
  themes: [
    // ... theme definitions
  ],
  defaultTheme: 'my-theme', // Theme name to use as default
};
```

If `defaultTheme` is not specified, ShellUI uses the built-in default theme.

## User Theme Selection

Users can change themes in Settings > Appearance. The selected theme is stored in user settings and persists across sessions.

## Color Guidelines

### Light Mode

- **Background**: Use light, neutral colors (e.g., white, light gray, beige)
- **Foreground**: Use dark colors for good contrast (e.g., dark gray, black)
- **Primary**: Your brand's primary color
- **Secondary**: Complementary accent color
- **Muted**: Subtle colors for less important elements

### Dark Mode

- **Background**: Use dark colors (e.g., dark gray, black)
- **Foreground**: Use light colors for contrast (e.g., light gray, white)
- **Primary**: Often lighter version of brand color for visibility
- **Secondary**: Maintains brand identity while being visible on dark backgrounds

### Accessibility

- Ensure sufficient contrast ratios (WCAG AA minimum: 4.5:1 for text, 3:1 for UI components)
- Test both light and dark modes
- Consider colorblind users when choosing color palettes

## Best Practices

1. **Define both modes**: Always provide both light and dark color definitions
2. **Use semantic colors**: Use `destructive` for errors, `primary` for actions, etc.
3. **Consistent spacing**: Use consistent `radius` values across your theme
4. **Font loading**: Prefer `fontFiles` for external fonts to ensure proper loading
5. **Fallback fonts**: Always include fallback fonts in font family declarations
6. **Test thoroughly**: Test your theme in both light and dark modes

## Related Guides

- [Layouts](/features/layouts) - Learn how themes work with different layouts
- [Internationalization](/features/internationalization) - Combine themes with multi-language support
