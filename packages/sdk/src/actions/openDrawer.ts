import type { OpenDrawerOptions } from '../types.js';

/**
 * Opens the drawer with optional url, position (top, bottom, left, right), and size (e.g. "400px", "80vh", "50vw").
 * Size is height for top/bottom drawers, width for left/right drawers.
 * If inside an iframe, sends a message to the parent to open the drawer.
 */
export function openDrawer(options?: OpenDrawerOptions): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = options
    ? {
        url: options.url ?? undefined,
        position: options.position ?? undefined,
        size: options.size ?? undefined,
      }
    : {};

  const message = {
    type: 'SHELLUI_OPEN_DRAWER',
    payload,
  };

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
