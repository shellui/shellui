/**
 * Handles URL changes and notifies parent if the path has changed
 * @param {Object} sdk - The SDK instance with currentPath property
 */
export function handleUrlChange(sdk) {
  if (typeof window === 'undefined') {
    return;
  }
  const newPath = window.location.pathname + window.location.search + window.location.hash;
  if (newPath !== sdk.currentPath) {
    sdk.currentPath = newPath;
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
}

/**
 * Sets up listeners for various URL change events
 * @param {Object} sdk - The SDK instance
 */
export function setupUrlMonitoring(sdk) {
  // Guard against SSR - window and document may not exist
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Listen for popstate (back/forward buttons)
  window.addEventListener('popstate', () => handleUrlChange(sdk));

  // Listen for hashchange
  window.addEventListener('hashchange', () => handleUrlChange(sdk));

  // Intercept pushState and replaceState
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleUrlChange(sdk);
  };

  window.history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleUrlChange(sdk);
  };

  // Monitor clicks on same-origin links to catch re-renders or local routing
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && new URL(link.href).origin === window.location.origin) {
      // Wait a bit for the framework to handle the route
      setTimeout(() => handleUrlChange(sdk), 0);
    }
  });
}
