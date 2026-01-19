/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

import { setupIframeMessageListener } from './utils/setupIframeMessageListener.js';
import { setupUrlMonitoring } from './utils/setupUrlMonitoring.js';
import { setupKeyListener } from './utils/setupKeyListener.js';
import { openModal as openModalAction } from './actions/openModal.js';
import { getLogger } from './logger/logger.js';
import { FrameRegistry } from './utils/frameRegistry.js';
import packageJson from '../package.json';

const logger = getLogger('shellsdk');

class ShellUISDK {
  constructor() {
    this.initialized = false;
    // Don't access window in constructor - it may not exist during SSR
    this.currentPath = typeof window !== 'undefined'
      ? window.location.pathname + window.location.search + window.location.hash
      : '';
    this.version = packageJson.version;
    // Frame registry for managing iframe references
    this.frameRegistry = new FrameRegistry();
  }

  /**
   * Initialize the SDK and start monitoring URL changes
   */
  init() {
    if (this.initialized) return this;

    // Monitor URL changes
    setupUrlMonitoring(this);

    // Listen for messages from nested iframes to propagate modal requests
    setupIframeMessageListener(this);

    // Listen for Escape key to close modal
    setupKeyListener();

    this.initialized = true;
    logger.info(`ShellUI SDK ${this.version} initialized`);
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

  /**
   * Gets the UUID for an iframe by its window reference
   * @param {Window} windowRef - The window object from event.source (iframe's contentWindow)
   * @returns {string|undefined} The UUID assigned to the iframe, or undefined if not found
   */
  getUuidByIframe(windowRef) {
    return this.frameRegistry.getUuidByIframe(windowRef);
  }

  /**
   * Adds an iframe reference and assigns a generated UUID to it
   * @param {HTMLIFrameElement} iframe - The iframe element to register
   * @returns {string} The UUID assigned to the iframe
   */
  addIframe(iframe) {
    return this.frameRegistry.addIframe(iframe);
  }

  /**
   * Removes an iframe reference by UUID or iframe element
   * @param {string|HTMLIFrameElement} identifier - The UUID string or iframe element to remove
   * @returns {boolean} True if the iframe was found and removed, false otherwise
   */
  removeIframe(identifier) {
    return this.frameRegistry.removeIframe(identifier);
  }
}

const sdk = new ShellUISDK();

export const init = () => sdk.init();
export const getVersion = () => sdk.getVersion();
export const openModal = (url) => openModalAction(url);
export const addIframe = (iframe) => sdk.addIframe(iframe);
export const removeIframe = (identifier) => sdk.removeIframe(identifier);
export { getLogger } from './logger/logger.js';
export const shellui = sdk;

export default sdk;
