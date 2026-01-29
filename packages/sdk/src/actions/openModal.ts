/**
 * Opens the settings modal with optional URL
 * If inside an iframe, sends a message to the parent to open the modal
 * If not in an iframe, dispatches a custom event that can be handled by the app
 */
export function openModal(url?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const message = {
    type: 'SHELLUI_OPEN_MODAL',
    payload: {
      url: url ?? null,
    },
  };

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
