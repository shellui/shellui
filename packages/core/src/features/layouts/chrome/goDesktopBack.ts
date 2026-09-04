import { IFRAME_FOREIGN_ATTR } from './constants';

export type DesktopBackIframe = {
  isConnected: boolean;
  src: string;
  contentWindow: {
    location: { href: string };
    history: { back: () => void; forward: () => void };
  } | null;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
};

export type DesktopBackResult = 'iframe' | 'overlay' | 'router';
export type DesktopForwardResult = 'iframe' | 'router';

/** Compare iframe locations; keeps hash so hash-router apps can go back/forward in-iframe. */
export function normalizeHref(href: string, base = 'http://localhost'): string {
  try {
    const url = new URL(href, base);
    const path = url.pathname.replace(/\/$/, '') || '/';
    return `${url.origin}${path === '/' ? '' : path}${url.search}${url.hash}`;
  } catch {
    return href.replace(/\/$/, '');
  }
}

/**
 * Only handle foreign-origin navigations (e.g. OAuth). Same-origin SPA / hash routes are
 * mirrored in the shell URL history — router back/forward + ContentView sync owns those.
 * Calling iframe history.back() here would fight shell history (duplicate or skipped entries).
 */
export function tryGoBackInIframe(iframe: DesktopBackIframe, _baseHref?: string): boolean {
  if (!iframe.isConnected) return false;

  if (iframe.getAttribute(IFRAME_FOREIGN_ATTR) === 'true') {
    const assigned = iframe.getAttribute('src') || iframe.src;
    if (assigned) {
      iframe.src = assigned;
      iframe.removeAttribute(IFRAME_FOREIGN_ATTR);
      return true;
    }
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

/**
 * Same-origin iframe forward is disabled for the same reason as back: shell URL history
 * mirrors the app. Keep the helper for tests / potential foreign-doc use later.
 */
export function tryGoForwardInIframe(iframe: DesktopBackIframe, baseHref?: string): boolean {
  if (!iframe.isConnected) return false;
  try {
    const win = iframe.contentWindow;
    if (!win) return false;
    const before = normalizeHref(win.location.href, baseHref);
    win.history.forward();
    const after = normalizeHref(win.location.href, baseHref);
    return after !== before;
  } catch {
    return false;
  }
}

export function goForwardInIframes(_iframes: DesktopBackIframe[], _baseHref?: string): boolean {
  // Shell owns mirrored SPA history — do not forward inside content iframes.
  return false;
}

export function goDesktopForward(options: {
  iframes?: DesktopBackIframe[];
  goRouterForward?: () => void;
  baseHref?: string;
}): DesktopForwardResult {
  if (options.iframes && goForwardInIframes(options.iframes, options.baseHref)) {
    return 'iframe';
  }
  options.goRouterForward?.();
  return 'router';
}
