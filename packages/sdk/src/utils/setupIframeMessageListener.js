import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

/**
 * Sets up a listener for messages from nested iframes
 * This ensures modal requests and settings updates from iframe content propagate to parent
 */
export function setupIframeMessageListener() {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('message', function(event) {

    if (window.parent === window) {
      return;
    }

    // Handle SHELLUI_OPEN_MODAL messages
    if (event.data?.type === 'SHELLUI_OPEN_MODAL') {
      window.parent.postMessage({
        type: 'SHELLUI_OPEN_MODAL',
        payload: event.data.payload
      }, '*');
      // If we're at top level, the message will be handled by ModalProvider
    }
    // Handle SHELLUI_SETTINGS_UPDATED messages
    else if (event.data?.type === 'SHELLUI_SETTINGS_UPDATED') {
      window.parent.postMessage({
        type: 'SHELLUI_SETTINGS_UPDATED',
        payload: event.data.payload
      }, '*');
    } 
    else {
      logger.warn('ShellSDK: unknown message', event.data)
    }
  });
}
