/**
 * Frame Registry
 * Manages iframe references with UUID tracking
 */

import { sanitizeCapabilityList } from '../marketplace/capabilities.js';
import { getLogger } from '../logger/logger.js';
import { generateUuid } from './uuid.js';

const logger = getLogger('shellsdk');

function originFromIframeSrc(iframe: HTMLIFrameElement): string | null {
  const src = iframe?.src?.trim();
  if (!src || src === 'about:blank') return null;
  try {
    return new URL(src, typeof window !== 'undefined' ? window.location.href : undefined).origin;
  } catch {
    return null;
  }
}

/**
 * Companion messages that prove the iframe document is alive and listening.
 * Shell must not send outbound traffic to a frame before one of these arrives.
 */
export const FRAME_LIVE_MESSAGE_TYPES = new Set([
  'SHELLUI_SETTINGS_REQUESTED',
  'SHELLUI_INITIALIZED',
]);

export type FrameCapabilityGrantInput = {
  origin: string;
  thirdParty: boolean;
  capabilities: readonly string[];
  /** App URLs this grant applies to. Matching is by origin and path prefix. */
  urls: readonly string[];
};

export type FrameCapabilityGrant = {
  origin: string;
  thirdParty: boolean;
  capabilities: ReadonlySet<string>;
  urls: readonly string[];
};

function frameMatchesAppUrl(frameSrc: string, appUrl: string): boolean {
  try {
    const frame = new URL(
      frameSrc,
      typeof window !== 'undefined' ? window.location.href : undefined,
    );
    const app = new URL(appUrl, typeof window !== 'undefined' ? window.location.href : undefined);
    if (frame.origin !== app.origin) return false;
    const appPath = framePathname(app.pathname);
    const framePath = framePathname(frame.pathname);
    if (appPath === '/') return true;
    return framePath === appPath || framePath.startsWith(`${appPath}/`);
  } catch {
    return false;
  }
}

function framePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export class FrameRegistry {
  private iframes = new Map<string, HTMLIFrameElement>();
  /** Frames that have completed (or started) the settings handshake. */
  private liveUuids = new Set<string>();
  /** Installed-app grants. Third-party `auth` is stripped on write. */
  private capabilityGrants = new Map<string, FrameCapabilityGrant>();

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

  /**
   * Replace installed-app capability grants.
   * Third-party grants drop `auth` even if the caller includes it.
   */
  setCapabilityGrants(grants: readonly FrameCapabilityGrantInput[]): void {
    this.capabilityGrants.clear();
    for (const grant of grants) {
      const origin = originFromUrl(grant.origin);
      if (!origin) continue;
      const urls = grant.urls.filter((url) => typeof url === 'string' && url.trim());
      const existing = this.capabilityGrants.get(origin);
      const thirdParty = Boolean(grant.thirdParty || existing?.thirdParty);
      let capabilities = sanitizeCapabilityList([...grant.capabilities], thirdParty);
      if (existing) {
        const previous = new Set(existing.capabilities);
        capabilities = capabilities.filter(
          (capability) =>
            previous.has(capability) ||
            (thirdParty && (capability === 'theme' || capability === 'locale')),
        );
        if (thirdParty) capabilities = sanitizeCapabilityList(capabilities, true);
      }
      this.capabilityGrants.set(origin, {
        origin,
        thirdParty,
        capabilities: new Set(capabilities),
        urls: [...new Set([...(existing?.urls ?? []), ...urls])],
      });
    }
  }

  getCapabilityGrant(origin: string): FrameCapabilityGrant | undefined {
    return this.capabilityGrants.get(origin);
  }

  /**
   * Grant for a concrete iframe URL.
   * A third-party grant covers the whole origin, so a frame cannot leave the
   * app path and keep first-party privileges.
   */
  matchCapabilityGrant(frameSrc: string | null | undefined): FrameCapabilityGrant | null {
    if (!frameSrc) return null;
    const origin = originFromUrl(frameSrc);
    for (const grant of this.capabilityGrants.values()) {
      if (grant.thirdParty && origin && grant.origin === origin) return grant;
      if (grant.urls.some((url) => frameMatchesAppUrl(frameSrc, url))) return grant;
    }
    return null;
  }

  /**
   * Drop iframes whose document URL belongs to an uninstalled app and forget
   * that URL on the capability grant. Returns the removed frame ids.
   */
  unregisterFramesForUrl(appUrl: string): string[] {
    let origin: string | null = null;
    try {
      origin = new URL(appUrl).origin;
    } catch {
      origin = null;
    }
    if (origin) {
      const grant = this.capabilityGrants.get(origin);
      if (grant) {
        const urls = grant.urls.filter((url) => !frameMatchesAppUrl(url, appUrl) && url !== appUrl);
        if (urls.length === 0) this.capabilityGrants.delete(origin);
        else this.capabilityGrants.set(origin, { ...grant, urls });
      }
    }

    const grantRemains = origin ? this.capabilityGrants.has(origin) : false;
    const removed: string[] = [];
    for (const [uuid, iframe] of this.iframes.entries()) {
      const src = iframe?.src?.trim();
      if (!src) continue;
      const sameApp = frameMatchesAppUrl(src, appUrl);
      const sameOrigin = origin !== null && originFromUrl(src) === origin;
      // When this was the last app on the origin, drop every frame from it.
      if (sameApp || (!grantRemains && sameOrigin)) {
        this.removeIframe(uuid);
        removed.push(uuid);
      }
    }
    return removed;
  }
}

function originFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
