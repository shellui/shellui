import { handleUrlChange } from './handleUrlChange.js';

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
