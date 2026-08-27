import type { OpenDrawerOptions } from '../types.js';

/**
 * Opens the drawer with optional url, position, size, and dismiss options.
 * Size may be a preset (`sm` | `md` | `lg` | `xl` | `full` | `content`) or a CSS length
 * (height for top/bottom, width for left/right).
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
        width: options.width,
        height: options.height,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        showCloseButton: options.showCloseButton,
        dismissible: options.dismissible,
        closeOnOverlayClick: options.closeOnOverlayClick,
        showDragHandle: options.showDragHandle,
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
