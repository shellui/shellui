/**
 * Frame Registry
 * Manages iframe references with UUID tracking
 */

import { getLogger } from '../logger/logger.js';
import { generateUuid } from './uuid.js';

const logger = getLogger('shellsdk');

/**
 * Companion messages that prove the iframe document is alive and listening.
 * Shell must not send outbound traffic to a frame before one of these arrives.
 */
export const FRAME_LIVE_MESSAGE_TYPES = new Set([
  'SHELLUI_SETTINGS_REQUESTED',
  'SHELLUI_INITIALIZED',
]);

export class FrameRegistry {
  private iframes = new Map<string, HTMLIFrameElement>();
  /** Frames that have completed (or started) the settings handshake. */
  private liveUuids = new Set<string>();

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
        this.liveUuids.delete(identifier);
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
          this.liveUuids.delete(uuid);
          logger.debug(`Removed iframe with UUID: ${uuid}`);
          return true;
        }
      }
      logger.warn('Iframe element not found in registry');
      return false;
    }
    throw new Error('removeIframe requires a UUID string or HTMLIFrameElement');
  }

  markLive(uuid: string): void {
    if (!this.iframes.has(uuid)) return;
    this.liveUuids.add(uuid);
    logger.debug(`Marked iframe live: ${uuid}`);
  }

  isLive(uuid: string): boolean {
    return this.liveUuids.has(uuid);
  }

  getAllIframes(): Array<[string, HTMLIFrameElement]> {
    return Array.from(this.iframes.entries());
  }

  getLiveIframes(): Array<[string, HTMLIFrameElement]> {
    return this.getAllIframes().filter(([uuid]) => this.liveUuids.has(uuid));
  }
}
