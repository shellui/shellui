/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

class ShellUISDK {
  constructor() {
    this.initialized = false;
    this.currentPath = window.location.pathname + window.location.search + window.location.hash;
    this.version = '0.0.1';
  }

  /**
   * Initialize the SDK and start monitoring URL changes
   */
  init() {
    if (this.initialized) return this;

    // Monitor URL changes
    this.setupUrlMonitoring();
    
    // Initial sync
    this.notifyParent();

    this.initialized = true;
    console.log('ShellUI SDK initialized');
    return this;
  }

  /**
   * Sets up listeners for various URL change events
   */
  setupUrlMonitoring() {
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

  getVersion() {
    return this.version;
  }
}

const sdk = new ShellUISDK();

export const init = () => sdk.init();
export const getVersion = () => sdk.getVersion();
export const shellui = sdk;

export default sdk;
