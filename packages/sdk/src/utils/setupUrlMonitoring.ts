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
 * Sets up listeners for various URL change events
 */
export function setupUrlMonitoring(sdk: ShellSDKLike): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  window.addEventListener('popstate', () => handleUrlChange(sdk));
  window.addEventListener('hashchange', () => handleUrlChange(sdk));

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (...args: Parameters<History['pushState']>) {
    originalPushState.apply(this, args);
    handleUrlChange(sdk);
  };

  window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
    originalReplaceState.apply(this, args);
    handleUrlChange(sdk);
  };

  document.addEventListener('click', (e: MouseEvent) => {
    const link = (e.target as Element)?.closest('a');
    if (link && link.href && new URL(link.href).origin === window.location.origin) {
      setTimeout(() => handleUrlChange(sdk), 0);
    }
  });
}
