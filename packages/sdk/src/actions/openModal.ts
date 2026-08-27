import type { OpenModalOptions } from '../types.js';

/**
 * Opens a URL in a modal overlay.
 * On desktop: centered dialog. On mobile: same call presents as a bottom drawer.
 * If inside an iframe, sends a message to the parent; otherwise posts on the same window.
 *
 * @example
 * openModal('/settings')
 * openModal({ url: '/settings', size: 'lg', showCloseButton: false })
 */
export function openModal(urlOrOptions?: string | OpenModalOptions): void {
  if (typeof window === 'undefined') {
    return;
  }

  const options: OpenModalOptions =
    typeof urlOrOptions === 'string' || urlOrOptions === undefined
      ? { url: urlOrOptions }
      : urlOrOptions;

  const message = {
    type: 'SHELLUI_OPEN_MODAL',
    payload: {
      url: options.url ?? null,
      size: options.size,
      width: options.width,
      height: options.height,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      showCloseButton: options.showCloseButton,
      dismissible: options.dismissible,
      closeOnOverlayClick: options.closeOnOverlayClick,
      movable: options.movable,
      resizable: options.resizable,
    },
  };

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
