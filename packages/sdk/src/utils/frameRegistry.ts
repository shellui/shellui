/**
 * Frame Registry
 * Manages iframe references with UUID tracking
 */

import { getLogger } from '../logger/logger.js';
import { generateUuid } from './uuid.js';

const logger = getLogger('shellsdk');

export class FrameRegistry {
  private iframes = new Map<string, HTMLIFrameElement>();

  getUuidByIframe(windowRef: Window | null | undefined): string | undefined {
    if (!windowRef) {
      return undefined;
    }

    for (const [uuid, iframe] of this.iframes.entries()) {
      if (iframe?.contentWindow === windowRef) {
        return uuid;
      }
    }

    return undefined;
  }

  addIframe(iframe: HTMLIFrameElement): string {
    if (!iframe || !(iframe instanceof HTMLIFrameElement)) {
      throw new Error('addIframe requires a valid HTMLIFrameElement');
    }

    const uuid = generateUuid();
    this.iframes.set(uuid, iframe);
    logger.debug(`Added iframe with UUID: ${uuid}`);
    return uuid;
  }

  removeIframe(identifier: string | HTMLIFrameElement): boolean {
    if (typeof identifier === 'string') {
      const removed = this.iframes.delete(identifier);
      if (removed) {
        logger.debug(`Removed iframe with UUID: ${identifier}`);
      } else {
        logger.warn(`Iframe with UUID not found: ${identifier}`);
      }
      return removed;
    }
    if (identifier instanceof HTMLIFrameElement) {
      for (const [uuid, iframe] of this.iframes.entries()) {
        if (iframe === identifier) {
          this.iframes.delete(uuid);
          logger.debug(`Removed iframe with UUID: ${uuid}`);
          return true;
        }
      }
      logger.warn('Iframe element not found in registry');
      return false;
    }
    throw new Error('removeIframe requires a UUID string or HTMLIFrameElement');
  }

  getAllIframes(): Array<[string, HTMLIFrameElement]> {
    return Array.from(this.iframes.entries());
  }
}
