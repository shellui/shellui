import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

/**
 * Sets up a listener for messages from nested iframes
 * This ensures modal requests and settings updates from iframe content propagate to parent
 */
export function setupIframeMessageListener(sdk) {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('message', function (event) {

    if (window.parent === window) {
      return;
    }

    const fromUuid = sdk.getUuidByIframe(event.source);
    if (!fromUuid) {
      logger.warn('ShellSDK: unknown iframe', {
        origin: event.origin,
        sourceType: event.source?.constructor?.name || 'unknown'
      });
      return;
    }
    const from = [fromUuid, ...(event.data.from || [])];

    // Handle SHELLUI_OPEN_MODAL messages
    if (event.data?.type === 'SHELLUI_OPEN_MODAL') {
      window.parent.postMessage({
        type: 'SHELLUI_OPEN_MODAL',
        from,
        payload: event.data.payload
      }, '*');
      // If we're at top level, the message will be handled by ModalProvider
    }
    // Handle SHELLUI_SETTINGS_UPDATED messages
    else if (event.data?.type === 'SHELLUI_SETTINGS_UPDATED') {
      window.parent.postMessage({
        type: 'SHELLUI_SETTINGS_UPDATED',
        from,
        payload: event.data.payload
      }, '*');
    }
    else {
      logger.warn('ShellSDK: unknown message', event.data)
    }
  });
}
