# Modals & Drawers

ShellUI supports opening content in modal overlays and side drawer panels, providing flexible ways to display content without navigating away from the current page.

## Modals

Modals display content in a centered overlay with a backdrop, perfect for focused interactions like settings or forms.

### Opening Modals via Navigation

Configure navigation items to open in modal mode:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
      openIn: 'modal', // Opens in modal overlay
    },
  ],
};
```

### Opening Modals Programmatically

Open modals programmatically using the SDK:

```javascript
import { shellui } from '@shellui/sdk';

// Initialize SDK
await shellui.init();

// Open a URL in a modal
shellui.openModal('/settings');

// Or with full URL
shellui.openModal('https://example.com/form');
```

### Closing Modals

Modals can be closed by:
- Clicking outside the modal (on the backdrop)
- Pressing the Escape key
- Programmatically (automatically handled by ShellUI)

## Drawers

Drawers slide in from the edges of the screen, perfect for sidebars, panels, or secondary content.

### Opening Drawers via Navigation

Configure navigation items to open in drawer mode:

```typescript
const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Sidebar',
      path: 'sidebar',
      url: '/sidebar',
      openIn: 'drawer',
      drawerPosition: 'right', // Optional, defaults to 'right'
    },
  ],
};
```

### Drawer Positions

Drawers can slide in from any direction:

```typescript
{
  label: 'Top Drawer',
  path: 'top',
  url: '/top',
  openIn: 'drawer',
  drawerPosition: 'top', // Slides down from top
}

{
  label: 'Bottom Drawer',
  path: 'bottom',
  url: '/bottom',
  openIn: 'drawer',
  drawerPosition: 'bottom', // Slides up from bottom
}

{
  label: 'Left Drawer',
  path: 'left',
  url: '/left',
  openIn: 'drawer',
  drawerPosition: 'left', // Slides in from left
}

{
  label: 'Right Drawer',
  path: 'right',
  url: '/right',
  openIn: 'drawer',
  drawerPosition: 'right', // Slides in from right (default)
}
```

### Opening Drawers Programmatically

Open drawers programmatically with full control:

```javascript
import { shellui } from '@shellui/sdk';

// Initialize SDK
await shellui.init();

// Open drawer with default position (right) and size
shellui.openDrawer({
  url: '/settings',
});

// Open drawer from left with custom size
shellui.openDrawer({
  url: '/sidebar',
  position: 'left',
  size: '400px', // Fixed width
});

// Open drawer from bottom with viewport-relative size
shellui.openDrawer({
  url: '/panel',
  position: 'bottom',
  size: '80vh', // 80% of viewport height
});

// Open drawer from top
shellui.openDrawer({
  url: '/menu',
  position: 'top',
  size: '50vh', // 50% of viewport height
});
```

### Drawer Size

Control drawer size using CSS length values:

```javascript
// Fixed pixel size
shellui.openDrawer({
  url: '/panel',
  size: '400px',
});

// Viewport-relative size
shellui.openDrawer({
  url: '/panel',
  size: '50vw', // 50% of viewport width (for left/right)
  size: '80vh', // 80% of viewport height (for top/bottom)
});

// Percentage-based
shellui.openDrawer({
  url: '/panel',
  size: '30%', // 30% of viewport
});
```

**Size Guidelines:**
- **Top/Bottom drawers**: Use height values (`vh`, `px` for height)
- **Left/Right drawers**: Use width values (`vw`, `px` for width)

### Closing Drawers

Drawers can be closed by:
- Clicking outside the drawer (on the backdrop)
- Pressing the Escape key
- Programmatically:

```javascript
shellui.closeDrawer();
```

## Use Cases

### Modals

Use modals for:
- **Settings panels**: Quick access to settings without leaving the page
- **Forms**: Focused form interactions
- **Confirmations**: Important actions requiring attention
- **Details**: Viewing item details without navigation

**Example:**
```typescript
{
  label: 'Quick Settings',
  path: 'settings',
  url: '/settings',
  openIn: 'modal',
}
```

### Drawers

Use drawers for:
- **Sidebars**: Additional navigation or filters
- **Panels**: Secondary content that doesn't need full focus
- **Menus**: Slide-out menus
- **Details**: Item details or information panels

**Example:**
```typescript
{
  label: 'Filters',
  path: 'filters',
  url: '/filters',
  openIn: 'drawer',
  drawerPosition: 'right',
}
```

## Complete Examples

### Settings Modal

```typescript
const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Settings',
      path: 'settings',
      url: '/settings',
      openIn: 'modal',
      position: 'end', // Appears in sidebar footer
    },
  ],
};
```

### Filter Drawer

```typescript
const config: ShellUIConfig = {
  navigation: [
    {
      label: 'Filters',
      path: 'filters',
      url: '/filters',
      openIn: 'drawer',
      drawerPosition: 'left',
    },
  ],
};
```

### Programmatic Drawer for Search

```javascript
function openSearchPanel() {
  shellui.openDrawer({
    url: '/search',
    position: 'top',
    size: '400px',
  });
}

// Close when search is complete
function closeSearchPanel() {
  shellui.closeDrawer();
}
```

### Dynamic Modal Based on User Action

```javascript
function viewItemDetails(itemId) {
  shellui.openModal(`/items/${itemId}`);
}

function editItem(itemId) {
  shellui.openModal(`/items/${itemId}/edit`);
}
```

## Best Practices

1. **Choose the right overlay**:
   - Use **modals** for focused, important interactions
   - Use **drawers** for secondary content or navigation

2. **Appropriate sizes**:
   - Modals: Let ShellUI handle sizing (responsive)
   - Drawers: Use appropriate sizes (e.g., `400px` for sidebars, `80vh` for panels)

3. **Position considerations**:
   - **Right drawer**: Common for sidebars and panels
   - **Left drawer**: Alternative sidebar position
   - **Top drawer**: Good for menus or notifications
   - **Bottom drawer**: Useful for mobile-friendly panels

4. **Mobile considerations**:
   - Drawers work well on mobile devices
   - Consider using bottom drawers for mobile-friendly interfaces

5. **Don't nest**: Avoid opening modals/drawers from within other modals/drawers

6. **Close properly**: Always provide a way to close (ShellUI handles Escape and backdrop clicks)

## Navigation vs Programmatic

### Navigation Configuration

Use navigation configuration when:
- The modal/drawer is part of your main navigation
- You want it accessible via sidebar/menu
- It's a persistent feature of your app

### Programmatic Opening

Use programmatic opening when:
- The modal/drawer is triggered by user actions
- It's contextual (e.g., "View Details" button)
- You need dynamic URLs or sizes
- It's not part of main navigation

## Related Guides

- [Navigation](/features/navigation) - Learn about navigation configuration
- [Toast Notifications](/features/toasts) - For non-blocking notifications
- [Alert Dialogs](/features/dialogs) - For confirmations and prompts
- [SDK Integration](/sdk) - Learn about the ShellUI SDK
