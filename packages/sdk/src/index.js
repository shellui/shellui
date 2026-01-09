/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

class ShellUISDK {
  constructor() {
    this.initialized = false;
    // Don't access window in constructor - it may not exist during SSR
    this.currentPath = typeof window !== 'undefined' 
      ? window.location.pathname + window.location.search + window.location.hash
      : '';
    this.version = '0.0.1';
  }

  /**
   * Initialize the SDK and start monitoring URL changes
   */
  init() {
    if (this.initialized) return this;

    // Monitor URL changes
    this.setupUrlMonitoring();
    
    // Listen for messages from nested iframes to propagate modal requests
    this.setupIframeMessageListener();
    
    // Initial sync
    this.notifyParent();

    this.initialized = true;
    console.log('ShellUI SDK initialized');
    return this;
  }

  /**
   * Sets up a listener for messages from nested iframes
   * This ensures modal requests from iframe content propagate to parent
   */
  setupIframeMessageListener() {
    if (typeof window === 'undefined') {
      return;
    }

    const self = this;
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

  /**
   * Sets up listeners for various URL change events
   */
  setupUrlMonitoring() {
    // Guard against SSR - window and document may not exist
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', () => this.handleUrlChange());

    // Listen for hashchange
    window.addEventListener('hashchange', () => this.handleUrlChange());

    // Intercept pushState and replaceState
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const self = this;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      self.handleUrlChange();
    };

    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      self.handleUrlChange();
    };

    // Monitor clicks on same-origin links to catch re-renders or local routing
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href && new URL(link.href).origin === window.location.origin) {
        // Wait a bit for the framework to handle the route
        setTimeout(() => this.handleUrlChange(), 0);
      }
    });
  }

  handleUrlChange() {
    if (typeof window === 'undefined') {
      return;
    }
    const newPath = window.location.pathname + window.location.search + window.location.hash;
    if (newPath !== this.currentPath) {
      this.currentPath = newPath;
      this.notifyParent();
    }
  }

  /**
   * Sends a message to the parent frame with the current path information
   */
  notifyParent() {
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

  /**
   * Opens the settings modal with optional URL
   * @param {string} [url] - Optional URL or path to load in the modal iframe. Must be same domain or relative.
   * If inside an iframe, sends a message to the parent to open the modal
   * If not in an iframe, dispatches a custom event that can be handled by the app
   */
  openModal(url) {
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

  getVersion() {
    return this.version;
  }
}

const sdk = new ShellUISDK();

export const init = () => sdk.init();
export const getVersion = () => sdk.getVersion();
export const shellui = sdk;

export default sdk;
