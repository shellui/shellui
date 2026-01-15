/**
 * Opens the settings modal with optional URL
 * @param {string} [url] - Optional URL or path to load in the modal iframe. Must be same domain or relative.
 * If inside an iframe, sends a message to the parent to open the modal
 * If not in an iframe, dispatches a custom event that can be handled by the app
 */
export function openModal(url) {
  if (typeof window === 'undefined') {
    return;
  }

  // Send message to parent frame to open modal
  const message = {
    type: 'SHELLUI_OPEN_MODAL',
    payload: {
      url: url || null
    }
  };

  // Check if we're inside an iframe
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
