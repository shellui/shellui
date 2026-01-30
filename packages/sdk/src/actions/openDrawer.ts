import type { DrawerPosition } from '../types.js';

/**
 * Opens the drawer with optional URL and position (top, bottom, left, right).
 * If inside an iframe, sends a message to the parent to open the drawer.
 */
export function openDrawer(url?: string, position?: DrawerPosition): void {
  if (typeof window === 'undefined') {
    return;
  }

  const message = {
    type: 'SHELLUI_OPEN_DRAWER',
    payload: {
      url: url ?? undefined,
      position: position ?? undefined,
    },
  };

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
