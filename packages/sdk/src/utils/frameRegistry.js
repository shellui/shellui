/**
 * Frame Registry
 * Manages iframe references with UUID tracking
 */

import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

/**
 * FrameRegistry class for managing iframe references with UUIDs
 */
export class FrameRegistry {
  constructor() {
    // Map to store iframe references with UUIDs
    this.iframes = new Map();
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
