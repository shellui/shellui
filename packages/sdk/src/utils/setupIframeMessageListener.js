/**
 * Sets up a listener for messages from nested iframes
 * This ensures modal requests from iframe content propagate to parent
 */
export function setupIframeMessageListener() {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('message', function(event) {
    // Only handle SHELLUI_OPEN_MODAL messages
    if (event.data?.type === 'SHELLUI_OPEN_MODAL') {
      // If we're in an iframe, propagate to parent
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'SHELLUI_OPEN_MODAL',
          payload: event.data.payload
        }, '*');
      }
      // If we're at top level, the message will be handled by ModalProvider
    }
  });
}
