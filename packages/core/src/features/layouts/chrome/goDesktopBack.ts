import { IFRAME_FOREIGN_ATTR } from './constants';

export type DesktopBackIframe = {
  isConnected: boolean;
  src: string;
  contentWindow: {
    location: { href: string };
    history: { back: () => void };
  } | null;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
};

export type DesktopBackResult = 'iframe' | 'overlay' | 'router';

export function normalizeHref(href: string, base = 'http://localhost'): string {
  try {
    const url = new URL(href, base);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return href.replace(/\/$/, '');
  }
}

export function tryGoBackInIframe(iframe: DesktopBackIframe, baseHref?: string): boolean {
  if (!iframe.isConnected) return false;

  if (iframe.getAttribute(IFRAME_FOREIGN_ATTR) === 'true') {
    const assigned = iframe.getAttribute('src') || iframe.src;
    if (assigned) {
      iframe.src = assigned;
      iframe.removeAttribute(IFRAME_FOREIGN_ATTR);
      return true;
    }
  }

  try {
    const win = iframe.contentWindow;
    if (!win) return false;
    const current = win.location.href;
    const assignedHref = new URL(iframe.src, baseHref || 'http://localhost').href;
    if (normalizeHref(current, baseHref) !== normalizeHref(assignedHref, baseHref)) {
      win.history.back();
      return true;
    }
  } catch {
    // Cross-origin and not flagged as a later navigation — leave the iframe as-is.
  }

  return false;
}

export function goBackInIframes(iframes: DesktopBackIframe[], baseHref?: string): boolean {
  for (let index = iframes.length - 1; index >= 0; index -= 1) {
    if (tryGoBackInIframe(iframes[index], baseHref)) return true;
  }
  return false;
}

export function goDesktopBack(options: {
  iframes?: DesktopBackIframe[];
  overlaysOpen?: boolean;
  closeOverlays?: () => void;
  goRouterBack?: () => void;
  baseHref?: string;
}): DesktopBackResult {
  if (options.iframes && goBackInIframes(options.iframes, options.baseHref)) {
    return 'iframe';
  }
  if (options.overlaysOpen) {
    options.closeOverlays?.();
    return 'overlay';
  }
  options.goRouterBack?.();
  return 'router';
}
