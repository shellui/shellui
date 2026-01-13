/**
 * Sends a message to the parent frame with the current path information
 */
export function notifyParent() {
  if (typeof window === 'undefined') {
    return;
  }
  const message = {
    type: 'SHELLUI_URL_CHANGED',
    payload: {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      fullPath: window.location.pathname + window.location.search + window.location.hash
    }
  };

  // Send to parent frame
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}
