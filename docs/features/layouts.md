# Layouts

Shellui supports four layout modes: sidebar (default), fullscreen, windows desktop (experimental), and app bar. Choose the layout that best fits your application's needs.

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

- Persistent sidebar navigation built on the shadcn/ui sidebar primitives
- Desktop: collapsible icon rail (click the trigger, rail, or press `⌘B` / `Ctrl+B`)
- Desktop: drag the expanded sidebar border to resize (200–480px; persisted for the tab session)
- Mobile: sheet/drawer sidebar opened from the top header trigger
- **Desktop app (Tauri):** overlay titlebar on macOS (traffic lights vertically centered in the 42px chrome; web controls get a 2px top pad for optical alignment). When the sidebar is collapsed, a full-width 42px top bar holds Back/Forward + open-sidebar (nav icons stay in the rail); when expanded, those controls sit in the sidebar header. A full-width invisible 42px top drag strip is mounted at the app root (all layouts and pages, including error screens). **Back** / **Forward** leave iframe login pages (there is no browser chrome).
- Supports icons, groups, and positioning
- Works with all navigation features
- Themed via sidebar CSS variables (`--sidebar-*`) for light and dark modes
- Optional `appIcon`: small square mark at the top of the expanded sidebar (left of the collapse control); hidden when the sidebar is collapsed

## Branding (`appIcon` / `logo`)

```json
{
  "appIcon": "/app-icon.svg",
  "logo": "/logo.svg"
}
```

- **`appIcon`**: Small square brand mark. Shown in the sidebar header (expanded), at the start of the app-bar, and on the windows start button.
- **Single path** (SVG or mono PNG): Shellui recolors it for light/dark via CSS.
- **Paired files** (typical for full-color PNGs):

```json
{
  "appIcon": {
    "light": "/app-icon-light.png",
    "dark": "/app-icon-dark.png"
  }
}
```

- **`logo`**: Wider wordmark asset (optional). Prefer `appIcon` for chrome.

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

## Windows Desktop Layout (Experimental)

The windows layout provides a desktop-like experience with a taskbar, start menu, and multi-window support. Each navigation item opens in its own draggable, resizable window.

> **Experimental:** The windows layout was implemented as a proof of concept to test the desktop-like experience. It works and can be tested (e.g. via Settings > Develop > Layout), but it is **not recommended for production use** at this time.

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
- **Start Menu**: Categorized app launcher (navigation groups become sections), polished list with icons, and open-window indicators
- **Multi-Window**: Each navigation item opens in its own window
- **Window Management**:
  - Drag windows to reposition
  - Resize windows by dragging edges
  - Minimize, maximize, and close windows
  - Focus windows by clicking them or their taskbar button
- **Desktop Background**: Full-bleed primary color wash behind open windows (follows the active theme)

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

The app bar layout uses a compact top bar (~52px) for navigation. Start destinations are shown as a horizontal row of text links with icons. Navigation groups appear as a label with a caret; clicking opens a dropdown of child links (the category looks selected when one of its children is active). When the bar runs out of space, remaining items move into a **More** menu. End links stay icon-only with a tooltip.

```typescript
const config: ShellUIConfig = {
  layout: 'app-bar',
  navigation: [
    {
      title: 'Apps',
      items: [
        {
          label: 'Dashboard',
          path: 'dashboard',
          url: '/',
          icon: '/icons/dashboard.svg',
        },
      ],
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

- **Top bar**: ~52px chrome with larger click targets (aligned under the Tauri safe-area / traffic-light band)
- **Start links**: Horizontal icon + label links; groups use a caret dropdown
- **Active state**: Matching link is highlighted; a category is highlighted when any child link is active
- **More**: Overflow menu at the end of the row on narrow viewports
- **End links**: Icon-only (or first letter) with tooltip on hover
- **Desktop app (Tauri):** traffic-light inset, Back/Forward controls, and window-drag regions on the bar

**Use cases:**

- Apps that prefer a top bar over a sidebar
- Dense UIs where vertical space is limited
- Primary destinations as top links; utility links as icons on the right

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

### Mobile / iOS fullscreen (all layouts)

- Shell height uses `--shellui-app-height` (`100dvh` in CSS). Safe-area insets are padding only. Installed / standalone apps use `@media (display-mode: standalone)` for body layout — no JS display-mode attributes or measured heights.
- Safe-area insets are **padding only** (titlebars, sheets, login). The main content iframe fills to the physical bottom — do not pad the outlet with bottom safe-area or the iframe looks cut off.
- **Iframe apps:** size to `100%` of the iframe (avoid `100vh` / `h-screen` / `min-h-screen`), and pad your own bottom chrome with `env(safe-area-inset-*)` when UI sits on the home-indicator band.
- Shell-owned pages (login, access pending, errors) use `.shellui-safe-pad` so content clears the notch and home indicator.

### Sidebar Layout

- **Mobile**: Sheet/drawer sidebar opened from the top header trigger
- **Desktop app**: On macOS Tauri, the native title bar is hidden; window controls overlay the sidebar. Drag the top of the sidebar or the transparent content strip to move the window. Use **Back** / **Forward** in the sidebar header for browser-like history (including iframe navigations such as a login screen).
- **Desktop**: Sidebar can be collapsed to icons (trigger, rail, or `⌘B` / `Ctrl+B`)
- **Groups**: Navigation groups appear as sections in the sidebar
- **Positioning**: Use `position: 'end'` to place items in sidebar footer

### Fullscreen Layout

- **Navigation**: No visible navigation UI, but routes still work
- **Direct URLs**: Users can still navigate via direct URLs
- **Embedding**: Perfect for embedding Shellui in other applications
- **Kiosk Mode**: Ideal for kiosk or single-purpose applications
- **Height**: Fills `#root` (`h-full`), same as sidebar / app-bar — not raw `100vh`

### Windows Layout

- **Experimental**: Proof of concept; suitable for testing but not recommended for production.
- **Window State**: Window positions and sizes are remembered per session
- **Performance**: Each window loads its content independently
- **Navigation**: Start menu provides access to all navigation items
- **Window Limits**: No hard limit on number of open windows, but performance may degrade with many windows

### App Bar Layout

- **Top bar**: ~52px chrome with icon + label start links and larger hit targets
- **Categories**: Group title + caret opens a dropdown; category is selected when a child is active
- **More**: Overflow menu holds links that do not fit
- **Start vs end**: Use `position: 'end'` on navigation items to show them as icon-only buttons on the right
- **Tooltips**: End links show full name on hover via native tooltip
- **Icons**: Set `icon` on start and end items; omit for first-letter fallback

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
   - Use `windows` only for testing or proof-of-concept (experimental; not recommended for production)
   - Use `app-bar` for a compact top bar with horizontal start links (and icon-only end links)

2. **Navigation items**: All layouts support the same navigation features, but visibility varies:
   - Sidebar: All items visible in sidebar
   - Fullscreen: No visible navigation, but routes work
   - Windows: Items accessible via start menu
   - App bar: Start items as horizontal links / category dropdowns (with More overflow); end items as icons with tooltips

3. **Mobile considerations**: Sidebar layout opens as a sheet from the top header on small screens

4. **Testing**: Test your application in all layout modes to ensure compatibility

## Related Guides

- [Navigation](/features/navigation) - Learn about navigation configuration
- [Themes](/features/themes) - Customize appearance for different layouts
