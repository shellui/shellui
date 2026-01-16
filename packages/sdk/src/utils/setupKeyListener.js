import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

/** const logger = getLogger('shellsdk');
 * Sets up a listener for the Escape key to close modal
 * If in an iframe, sends a message to the parent
 * @returns {() => void} Cleanup function to remove the event listener
 */
export function setupKeyListener() {
  if (typeof window === 'undefined') {
    return () => {}; // Return no-op cleanup function
  }

  const handleEscape = (event) => {
    if (event.key === 'Escape' || event.keyCode === 27) {
      // Check if we're inside an iframe
      if (window.parent !== window) {
        const message = {
          type: 'SHELLUI_CLOSE_MODAL'
        };
        window.parent.postMessage(message, '*');
        logger.info('Escape key pressed, sending message to parent to close modal');
      }
    }
  };

  window.addEventListener('keydown', handleEscape);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleEscape);
  };
}
