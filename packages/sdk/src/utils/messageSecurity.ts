/**
 * Origin allowlist and trusted-frame checks for Shellui postMessage traffic.
 */

import type { FrameRegistry } from './frameRegistry.js';

export type MessageSourceKind = 'same-window' | 'parent' | 'registered-frame' | 'untrusted';

/**
 * Companion → shell messages that must come from a registered iframe or same-window
 * (Settings → Develop). Parent-only sources are rejected for these types.
 */
export const PRIVILEGED_COMPANION_MESSAGE_TYPES = new Set([
  'SHELLUI_LOGIN',
  'SHELLUI_LOGOUT',
  'SHELLUI_OPEN_MODAL',
  'SHELLUI_CLOSE_MODAL',
  'SHELLUI_OPEN_DRAWER',
  'SHELLUI_CLOSE_DRAWER',
  'SHELLUI_TOAST',
  'SHELLUI_TOAST_UPDATE',
  'SHELLUI_DIALOG',
  'SHELLUI_DIALOG_UPDATE',
  'SHELLUI_ACTIONS_SET',
  'SHELLUI_ACTIONS_CLEAR',
  'SHELLUI_NAVIGATE',
  'SHELLUI_URL_CHANGED',
  'SHELLUI_INITIALIZED',
  'SHELLUI_CONTENT_SCROLL',
  'SHELLUI_OVERLAY_SIZE',
  'SHELLUI_STORAGE_REQUEST',
  'SHELLUI_SELECT_STORAGE',
  'SHELLUI_SETTINGS_REQUESTED',
]);

const originFromUrl = (value: string | undefined | null): string | null => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

/** Collect unique origins from absolute http(s) URLs (nav apps, storage, admin, etc.). */
export function collectOriginsFromUrls(...urls: (string | undefined | null)[]): string[] {
  const origins = new Set<string>();
  for (const url of urls) {
    const origin = originFromUrl(url);
    if (origin) origins.add(origin);
  }
  return [...origins];
}

export class MessageSecurityPolicy {
  private extraAllowedOrigins = new Set<string>();

  configure(options?: { allowedOrigins?: string[] }): void {
    this.extraAllowedOrigins.clear();
    if (options?.allowedOrigins) {
      for (const origin of options.allowedOrigins) {
        const trimmed = origin?.trim();
        if (trimmed) this.extraAllowedOrigins.add(trimmed);
      }
    }
  }

  getAllowedOrigins(): string[] {
    const origins = new Set<string>();
    if (typeof window !== 'undefined') {
      origins.add(window.location.origin);
      // Embedded companions always trust the parent shell origin (same as tiny).
      // Cross-origin dev (e.g. :4000 ↔ :5173) otherwise rejects SHELLUI_SETTINGS.
      if (window.parent !== window) {
        const parentOrigin = resolveParentTargetOrigin();
        if (parentOrigin && parentOrigin !== '*' && parentOrigin !== 'null') {
          origins.add(parentOrigin);
        }
      }
    }
    for (const origin of this.extraAllowedOrigins) {
      origins.add(origin);
    }
    return [...origins];
  }

  isOriginAllowed(origin: string): boolean {
    if (!origin || origin === 'null') return false;
    return this.getAllowedOrigins().includes(origin);
  }

  classifySource(event: MessageEvent, frameRegistry: FrameRegistry | null): MessageSourceKind {
    const source = event.source;
    if (typeof window === 'undefined') return 'untrusted';
    if (source === window || source === null) return 'same-window';
    if (source === window.parent) return 'parent';
    if (frameRegistry?.getUuidByIframe(source as Window)) return 'registered-frame';
    return 'untrusted';
  }

  isTrustedInboundMessage(
    event: MessageEvent,
    frameRegistry: FrameRegistry | null,
    messageType: string,
  ): boolean {
    if (!this.isOriginAllowed(event.origin)) return false;

    const sourceKind = this.classifySource(event, frameRegistry);
    if (sourceKind === 'untrusted') return false;

    if (PRIVILEGED_COMPANION_MESSAGE_TYPES.has(messageType)) {
      return sourceKind === 'registered-frame' || sourceKind === 'same-window';
    }

    return true;
  }
}

export function resolveSelfTargetOrigin(): string {
  if (typeof window === 'undefined') return '*';
  return window.location.origin;
}

/** Target origin for iframe → parent posts. */
export function resolveParentTargetOrigin(): string {
  if (typeof window === 'undefined') return '*';
  if (window.parent === window) return window.location.origin;

  if (typeof document !== 'undefined') {
    const locationWithAncestors = document.location as Location & {
      ancestorOrigins?: DOMStringList;
    };
    const ancestors = locationWithAncestors.ancestorOrigins;
    const ancestorOrigin = ancestors?.[0];
    if (ancestorOrigin) return ancestorOrigin;

    if (document.referrer) {
      try {
        return new URL(document.referrer).origin;
      } catch {
        /* ignore */
      }
    }
  }

  return window.location.origin;
}

/** Target origin for shell → iframe posts. */
export function resolveIframeTargetOrigin(
  iframe: HTMLIFrameElement,
  fallbackOrigin?: string,
): string | null {
  const fallback = fallbackOrigin ?? resolveSelfTargetOrigin();
  const src = iframe?.src?.trim();
  if (!src || src === 'about:blank') return fallback;
  try {
    return new URL(src, typeof window !== 'undefined' ? window.location.href : undefined).origin;
  } catch {
    return fallback;
  }
}

/**
 * Whether `iframe.contentWindow` is ready for `postMessage(..., targetOrigin)`.
 *
 * Fresh iframes start at `about:blank`, which inherits the shell origin. Posting
 * with the companion `src` origin then fails with:
 * "The target origin provided (…) does not match the recipient window’s origin (…)"
 * and the message is dropped — a common localhost white-screen handshake race.
 */
export function isIframeReadyForTargetOrigin(
  iframe: HTMLIFrameElement,
  targetOrigin: string,
): boolean {
  const win = iframe?.contentWindow;
  if (!win || !targetOrigin || targetOrigin === 'null') return false;
  try {
    // Readable ⇒ same-origin with the caller (shell). about:blank inherits shell origin.
    return win.location.origin === targetOrigin;
  } catch {
    // Cross-origin document — browsing context left the shell origin.
    return true;
  }
}
