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

  /**
   * If `source` is an iframe browsing context already in the DOM but not yet
   * registered (React commit vs companion init race), register it and return
   * its UUID.
   *
   * Falls back to a unique `src` origin match when `contentWindow === source`
   * fails (seen across some browsers / sandbox edge cases).
   */
  adoptWindow(source: Window | null | undefined, origin?: string | null): string | undefined {
    if (!source && !origin) return undefined;

    if (source) {
      const existing = this.getUuidByIframe(source);
      if (existing) return existing;
    }

    if (typeof document === 'undefined') return undefined;

    const domIframes = Array.from(document.querySelectorAll('iframe'));

    if (source) {
      for (const node of domIframes) {
        if (node.contentWindow === source) {
          return this.addIframe(node);
        }
      }
    }

    if (origin) {
      const byOrigin = domIframes.filter((node) => originFromIframeSrc(node) === origin);
      if (byOrigin.length === 1) {
        return this.addIframe(byOrigin[0]);
      }
      if (byOrigin.length > 1) {
        logger.debug('adoptWindow: multiple iframes share origin, need contentWindow match', {
          origin,
          count: byOrigin.length,
        });
      }
    }

    return undefined;
  }

  addIframe(iframe: HTMLIFrameElement): string {
    if (!iframe) {
      throw new Error('addIframe requires a valid HTMLIFrameElement');
    }
    const isIframe =
      (typeof HTMLIFrameElement !== 'undefined' && iframe instanceof HTMLIFrameElement) ||
      (iframe as unknown as { tagName?: string }).tagName === 'IFRAME';
    if (!isIframe) {
      throw new Error('addIframe requires a valid HTMLIFrameElement');
    }

    for (const [uuid, existing] of this.iframes.entries()) {
      if (existing === iframe) {
        return uuid;
      }
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
