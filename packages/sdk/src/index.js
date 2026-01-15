/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

import { setupIframeMessageListener } from './utils/setupIframeMessageListener.js';
import { setupUrlMonitoring } from './utils/setupUrlMonitoring.js';
import { setupKeyListener } from './utils/setupKeyListener.js';
import { openModal as openModalAction } from './actions/openModal.js';
import packageJson from '../package.json';

class ShellUISDK {
  constructor() {
    this.initialized = false;
    // Don't access window in constructor - it may not exist during SSR
    this.currentPath = typeof window !== 'undefined' 
      ? window.location.pathname + window.location.search + window.location.hash
      : '';
    this.version = packageJson.version;
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
    setupKeyListener();
    
    this.initialized = true;
    console.log('ShellUI SDK initialized');
    return this;
  }


  /**
   * Opens the settings modal with optional URL
   * @param {string} [url] - Optional URL or path to load in the modal iframe. Must be same domain or relative.
   * If inside an iframe, sends a message to the parent to open the modal
   * If not in an iframe, dispatches a custom event that can be handled by the app
   */
  openModal(url) {
    openModalAction(url);
  }

  getVersion() {
    return this.version;
  }
}

const sdk = new ShellUISDK();

export const init = () => sdk.init();
export const getVersion = () => sdk.getVersion();
export const openModal = (url) => openModalAction(url);
export const shellui = sdk;

export default sdk;
