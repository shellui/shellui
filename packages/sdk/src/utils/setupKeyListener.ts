import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

/**
 * Sets up a listener for the Escape key to close modal
 * If in an iframe, sends a message to the parent
 * @returns Cleanup function to remove the event listener
 */
export function setupKeyListener(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.keyCode === 27) {
      logger.info(
        `${event.key} (${event.keyCode}) pressed ${
          window.parent !== window ? 'inside iframe' : 'at top level'
        }`,
        {
          key: event.key,
          keyCode: event.keyCode,
          code: event.code,
        },
      );

      if (window.parent !== window) {
        window.parent.postMessage({ type: 'SHELLUI_CLOSE_MODAL', payload: {} }, '*');
        window.parent.postMessage({ type: 'SHELLUI_CLOSE_DRAWER', payload: {} }, '*');
      }
    }
  };

  window.addEventListener('keydown', handleEscape);

  return () => {
    window.removeEventListener('keydown', handleEscape);
  };
}
