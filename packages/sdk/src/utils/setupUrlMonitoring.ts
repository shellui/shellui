import { getLogger } from '../logger/logger.js';
import { shellui } from '../index.js';

const logger = getLogger('shellsdk');

export interface ShellSDKLike {
  currentPath: string;
}

/**
 * Handles URL changes and notifies parent if the path has changed
 */
export function handleUrlChange(sdk: ShellSDKLike): void {
  if (typeof window === 'undefined') {
    return;
  }
  const newPath = window.location.pathname + window.location.search + window.location.hash;
  if (newPath !== sdk.currentPath) {
    sdk.currentPath = newPath;
    if (typeof window === 'undefined') {
      return;
    }

    const message = {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      fullPath: window.location.pathname + window.location.search + window.location.hash,
    };

    if (window.parent !== window) {
      shellui.sendMessageToParent({
        type: 'SHELLUI_URL_CHANGED',
        payload: message,
      });
      logger.debug('Sent SHELLUI_URL_CHANGED message to parent', message);
    }
  }
}

/**
 * Sets up listeners for various URL change events.
 * When embedded in a shell iframe, pushState is downgraded to replaceState so the
 * iframe does not add joint session-history entries — the shell mirrors routes and
 * owns the back/forward stack.
 */
export function setupUrlMonitoring(sdk: ShellSDKLike): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  window.addEventListener('popstate', () => handleUrlChange(sdk));
  window.addEventListener('hashchange', () => handleUrlChange(sdk));

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);
  // Only when embedded: apps that call shellui.init() in a top-level tab keep normal history.
  const embedded = window.parent !== window;

  window.history.pushState = function (...args: Parameters<History['pushState']>) {
    if (embedded) {
      originalReplaceState(...args);
    } else {
      originalPushState(...args);
    }
    handleUrlChange(sdk);
  };

  window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
    originalReplaceState(...args);
    handleUrlChange(sdk);
  };

  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const link = (e.target as Element)?.closest('a');
      if (!link || !link.href) return;
      // Don't intercept modified clicks (new tab, etc.)
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      if (link.target && link.target !== '' && link.target !== '_self') {
        return;
      }
      try {
        const next = new URL(link.href);
        if (next.origin !== window.location.origin) return;

        // Same-document hash links normally push joint history; replace instead when embedded.
        if (
          embedded &&
          next.pathname === window.location.pathname &&
          next.search === window.location.search &&
          next.hash !== window.location.hash
        ) {
          e.preventDefault();
          originalReplaceState(null, '', `${next.pathname}${next.search}${next.hash || ''}`);
          handleUrlChange(sdk);
          return;
        }

        setTimeout(() => handleUrlChange(sdk), 0);
      } catch {
        // ignore invalid URLs
      }
    },
    true,
  );
}
