/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

import { setupIframeMessageListener } from './utils/setupIframeMessageListener.js';
import { setupUrlMonitoring } from './utils/setupUrlMonitoring.js';

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
    setupUrlMonitoring(this);
    
    // Listen for messages from nested iframes to propagate modal requests
    setupIframeMessageListener();
    
    // Listen for Escape key to close modal
    this.setupEscapeKeyListener();
    
    this.initialized = true;
    console.log('ShellUI SDK initialized');
    return this;
  }

  /**
   * Sets up a listener for the Escape key to close modal
   * If in an iframe, sends a message to the parent
   */
  setupEscapeKeyListener() {
    if (typeof window === 'undefined') {
      return;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        // Check if we're inside an iframe
        if (window.parent !== window) {
          const message = {
            type: 'SHELLUI_CLOSE_MODAL'
          };
          window.parent.postMessage(message, '*');
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    
    // Store cleanup function for potential future use
    this._escapeKeyCleanup = () => {
      window.removeEventListener('keydown', handleEscape);
    };
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
