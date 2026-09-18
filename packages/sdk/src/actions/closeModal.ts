import { postShellMessage } from '../utils/postShellMessage.js';

/**
 * Closes the modal overlay.
 * If inside an iframe, sends a message to the parent; otherwise posts on the same window.
 */
export function closeModal(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const message = {
    type: 'SHELLUI_CLOSE_MODAL',
    payload: {},
  };

  postShellMessage(message);
}
