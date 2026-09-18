import { postShellMessage } from '../utils/postShellMessage.js';

/**
 * Closes the drawer.
 * If inside an iframe, sends a message to the parent to close the drawer.
 */
export function closeDrawer(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const message = {
    type: 'SHELLUI_CLOSE_DRAWER',
    payload: {},
  };

  postShellMessage(message);
}
