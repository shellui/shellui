/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

import { setupIframeMessageListener } from './utils/setupIframeMessageListener.js';
import { setupUrlMonitoring } from './utils/setupUrlMonitoring.js';
import { setupKeyListener } from './utils/setupKeyListener.js';
import { openModal as openModalAction } from './actions/openModal.js';
import { getLogger } from './logger/logger.js';
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
    // Map to store iframe references with UUIDs
    this.iframes = new Map();
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
    if (!windowRef) {
      return undefined;
    }

    // Iterate through the Map to find the iframe whose contentWindow matches
    for (const [uuid, iframe] of this.iframes.entries()) {
      // event.source is the iframe's contentWindow, so we need to compare
      if (iframe && iframe.contentWindow === windowRef) {
        return uuid;
      }
    }

    return undefined;
  }

  /**
   * Adds an iframe reference and assigns a generated UUID to it
   * @param {HTMLIFrameElement} iframe - The iframe element to register
   * @returns {string} The UUID assigned to the iframe
   */
  addIframe(iframe) {
    if (!iframe || !(iframe instanceof HTMLIFrameElement)) {
      throw new Error('addIframe requires a valid HTMLIFrameElement');
    }

    // Generate UUID using crypto.randomUUID() if available, otherwise fallback
    let uuid;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      uuid = crypto.randomUUID();
    } else {
      // Fallback UUID v4 generator
      uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    this.iframes.set(uuid, iframe);
    logger.debug(`Added iframe with UUID: ${uuid}`);
    return uuid;
  }

  /**
   * Removes an iframe reference by UUID or iframe element
   * @param {string|HTMLIFrameElement} identifier - The UUID string or iframe element to remove
   * @returns {boolean} True if the iframe was found and removed, false otherwise
   */
  removeIframe(identifier) {
    if (typeof identifier === 'string') {
      // Remove by UUID
      const removed = this.iframes.delete(identifier);
      if (removed) {
        logger.debug(`Removed iframe with UUID: ${identifier}`);
      } else {
        logger.warn(`Iframe with UUID not found: ${identifier}`);
      }
      return removed;
    } else if (identifier instanceof HTMLIFrameElement) {
      // Remove by iframe element reference
      for (const [uuid, iframe] of this.iframes.entries()) {
        if (iframe === identifier) {
          this.iframes.delete(uuid);
          logger.debug(`Removed iframe with UUID: ${uuid}`);
          return true;
        }
      }
      logger.warn('Iframe element not found in registry');
      return false;
    } else {
      throw new Error('removeIframe requires a UUID string or HTMLIFrameElement');
    }
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
