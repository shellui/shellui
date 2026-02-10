# Layouts

ShellUI supports four layout modes: sidebar (default), fullscreen, windows desktop, and app bar. Choose the layout that best fits your application's needs.

## Sidebar Layout (Default)

The sidebar layout displays a navigation sidebar alongside your content. This is the default layout and works well for most applications.

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  layout: 'sidebar', // Optional, this is the default
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: '/',
    },
  ],
};
```

**Features:**

- Persistent sidebar navigation
- Responsive design (collapses to bottom navigation on mobile)
- Supports icons, groups, and positioning
- Works with all navigation features

## Fullscreen Layout

The fullscreen layout shows only the content area with no navigation sidebar. Useful for embedded applications or when you want maximum screen space.

```typescript
const config: ShellUIConfig = {
  layout: 'fullscreen',
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: '/',
    },
  ],
};
```

**Features:**

- No sidebar or navigation UI
- Maximum content area
- Navigation items still work (routes are valid)
- Useful for embedded or kiosk applications

**Note:** Even though there's no visible navigation, the routes defined in your navigation configuration are still accessible via direct URLs.

## Windows Desktop Layout

The windows layout provides a desktop-like experience with a taskbar, start menu, and multi-window support. Each navigation item opens in its own draggable, resizable window.

```typescript
const config: ShellUIConfig = {
  layout: 'windows',
  navigation: [
    {
      label: 'Dashboard',
      path: 'dashboard',
      url: '/',
    },
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
    },
  ],
};
```

**Features:**

- **Taskbar**: Bottom taskbar with app buttons and system clock
- **Start Menu**: Click the start button to see all navigation items
- **Multi-Window**: Each navigation item opens in its own window
- **Window Management**:
  - Drag windows to reposition
  - Resize windows by dragging edges
  - Minimize, maximize, and close windows
  - Focus windows by clicking them or their taskbar button
- **Desktop Background**: Customizable desktop area

**Window Controls:**

- Click and drag the title bar to move windows
- Drag window edges to resize
- Click the minimize button to minimize
- Click the maximize button to maximize/restore
- Click the close button to close the window

**Taskbar:**

- Shows buttons for all open windows
- Click a button to focus that window
- System clock displays current time
- Start button opens the navigation menu

## App Bar Layout

The app bar layout uses a compact top bar (max height 42px) for navigation. Start links are shown in a select menu; end links are shown as icon-only buttons (or a first-letter badge when no icon is set), with a tooltip on hover showing the full name.

```typescript
const config: ShellUIConfig = {
  layout: 'app-bar',
  navigation: [
    {
      label: 'Dashboard',
      path: 'dashboard',
      url: '/',
      icon: '/icons/dashboard.svg',
    },
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
      position: 'end',
    },
  ],
};
```

**Features:**

- **Top bar**: Compact bar (max 42px) with logo/title on the left
- **Start links**: Displayed in a select dropdown for space-efficient navigation
- **End links**: Icon-only (or first letter) with tooltip on hover for full name
- **Responsive**: Single row layout suitable for app-style UIs

**Use cases:**

- Apps that prefer a top bar over a sidebar
- Dense UIs where vertical space is limited
- When you want main nav in a dropdown and utility links (e.g. Settings) as icons on the right

## Changing Layouts

### Configuration-Based

Set the layout in your configuration file:

```typescript
const config: ShellUIConfig = {
  layout: 'windows', // 'sidebar' | 'fullscreen' | 'windows' | 'app-bar'
  // ... rest of config
};
```

### Runtime Override

Users can override the layout at runtime through Settings > Develop > Layout (if developer features are enabled). This override is stored in user settings and takes precedence over the configuration.

```typescript
// In your app code, you can check the effective layout:
import { useSettings } from '@shellui/core';

function MyComponent() {
  const { settings } = useSettings();
  const effectiveLayout = settings.layout ?? config.layout;
  // effectiveLayout will be 'sidebar' | 'fullscreen' | 'windows' | 'app-bar'
}
```

## Layout-Specific Considerations

### Sidebar Layout

- **Mobile**: Automatically switches to bottom navigation bar
- **Desktop**: Sidebar can be collapsed/expanded
- **Groups**: Navigation groups appear as sections in the sidebar
- **Positioning**: Use `position: 'end'` to place items in sidebar footer

### Fullscreen Layout

- **Navigation**: No visible navigation UI, but routes still work
- **Direct URLs**: Users can still navigate via direct URLs
- **Embedding**: Perfect for embedding ShellUI in other applications
- **Kiosk Mode**: Ideal for kiosk or single-purpose applications

### Windows Layout

- **Window State**: Window positions and sizes are remembered per session
- **Performance**: Each window loads its content independently
- **Navigation**: Start menu provides access to all navigation items
- **Window Limits**: No hard limit on number of open windows, but performance may degrade with many windows

### App Bar Layout

- **Top bar**: Fixed max height of 42px; logo/title and select stay compact
- **Start vs end**: Use `position: 'end'` on navigation items to show them as icon-only buttons on the right
- **Tooltips**: End links show full name on hover via native tooltip
- **Icons**: Set `icon` on items for end bar; omit for first-letter fallback

## Complete Example

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  layout: 'sidebar', // or 'fullscreen', 'windows', or 'app-bar'
  title: 'My App',
  navigation: [
    {
      label: 'Dashboard',
      path: 'dashboard',
      url: '/',
      icon: '/icons/dashboard.svg',
    },
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
      icon: '/icons/settings.svg',
    },
  ],
};

export default config;
```

## Best Practices

1. **Choose the right layout**:
   - Use `sidebar` for most web applications
   - Use `fullscreen` for embedded or kiosk applications
   - Use `windows` for desktop-like experiences or multi-tasking scenarios
   - Use `app-bar` for a compact top bar with select menu and icon-only end links

2. **Navigation items**: All layouts support the same navigation features, but visibility varies:
   - Sidebar: All items visible in sidebar
   - Fullscreen: No visible navigation, but routes work
   - Windows: Items accessible via start menu
   - App bar: Start items in a select; end items as icons with tooltips

3. **Mobile considerations**: Sidebar layout automatically adapts to mobile with bottom navigation

4. **Testing**: Test your application in all layout modes to ensure compatibility

## Related Guides

- [Navigation](/features/navigation) - Learn about navigation configuration
- [Themes](/features/themes) - Customize appearance for different layouts
