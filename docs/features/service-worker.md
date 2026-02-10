# Service Worker

ShellUI includes a service worker that provides offline support, automatic app updates, and intelligent caching strategies.

## Overview

The service worker:

- **Caches assets** for offline access
- **Detects updates** automatically
- **Notifies users** when updates are available
- **Updates seamlessly** on page refresh
- **Works in production** builds only (disabled in development)

## Automatic Registration

The service worker is automatically registered when:

- Running in production build
- Navigation items are configured
- Not running in Tauri (desktop apps use different caching)

No configuration needed - it works out of the box!

## Update Detection

ShellUI automatically detects when a new version of your app is available:

1. **Background Check**: Service worker checks for updates in the background
2. **Update Found**: When an update is detected, a notification appears
3. **User Choice**: User can update now or later
4. **Automatic Update**: On page refresh, the new version activates automatically

## Update Notifications

Users see toast notifications when updates are available:

- **Update Available**: "A new version is available. Refresh to update."
- **Update Installed**: "Update installed. Refresh to activate."

Users can:

- Click "Refresh" to update immediately
- Dismiss and update later (updates automatically on next page load)

## User Controls

Users can control the service worker in Settings > Advanced > Service Worker:

- **Enable/Disable**: Toggle service worker on or off
- **Status**: See current registration status
- **Update Check**: Manually check for updates
- **Unregister**: Remove service worker (if needed)

## Caching Strategies

ShellUI uses intelligent caching strategies:

### Precache

- **What**: All assets generated during build (HTML, CSS, JS, images)
- **Strategy**: Cache-first with network fallback
- **When**: On service worker installation

### Navigation

- **What**: HTML pages and routes
- **Strategy**: Network-first with cache fallback
- **When**: User navigates to a route

### API Calls

- **What**: External API requests
- **Strategy**: Network-first (not cached by default)
- **When**: API requests are made

## Offline Support

When offline, ShellUI:

- Serves cached assets
- Shows cached pages
- Displays offline indicators (if configured)
- Queues actions for when connection is restored

## Configuration

### Disable Service Worker

Disable the service worker in your configuration:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  runtime: 'tauri', // Disables service worker (for Tauri apps)
  // ... rest of config
};
```

Or disable via user settings (Settings > Advanced > Service Worker).

### Tauri Runtime

When running in Tauri, the service worker is automatically disabled:

```typescript
const config: ShellUIConfig = {
  runtime: 'tauri', // Service worker disabled automatically
  // ... rest of config
};
```

Tauri uses its own caching system, so the service worker is not needed.

## Update Behavior

### Automatic Updates

On page refresh, ShellUI automatically:

1. Checks for waiting service worker
2. Activates the new version
3. Reloads the page with the new version

This ensures users always get the latest version after refreshing.

### Manual Updates

Users can manually update:

1. Go to Settings > Advanced > Service Worker
2. Click "Check for Updates"
3. If an update is available, click "Refresh" when prompted

## Service Worker Lifecycle

1. **Installation**: Service worker installs and caches assets
2. **Activation**: Service worker activates and takes control
3. **Update Check**: Periodically checks for new versions
4. **Update Found**: New service worker installs in background
5. **Waiting**: New service worker waits for page refresh
6. **Activation**: On refresh, new service worker activates

## Best Practices

1. **Let it work**: Service worker works automatically - no configuration needed
2. **Test updates**: Test your update flow before deploying
3. **Version your builds**: Use version numbers or build IDs to track updates
4. **Inform users**: Let users know when updates are available
5. **Handle offline**: Design your app to work offline when possible

## Troubleshooting

### Service Worker Not Registering

**Check:**

- Are you running a production build? (Service worker is disabled in development)
- Do you have navigation items configured?
- Are you running in Tauri? (Service worker is disabled)

### Updates Not Detecting

**Check:**

- Is the service worker file (`sw.js`) being generated?
- Are you deploying new builds correctly?
- Is the browser cache cleared?

### Service Worker Stuck

**Solution:**

1. Go to Settings > Advanced > Service Worker
2. Click "Unregister"
3. Refresh the page
4. Service worker will re-register

## Development vs Production

### Development

- Service worker is **disabled** by default
- Hot module replacement works normally
- No caching interference

### Production

- Service worker is **enabled** automatically
- Assets are cached for offline access
- Updates are detected automatically

## Related Guides

- [CLI Reference](/cli) - Building for production
- [Tauri Integration](/tauri) - Desktop apps (service worker disabled)
