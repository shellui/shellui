import type { LoginOptions } from '../types.js';

/**
 * Requests login in the shell context.
 * Useful when nested in an iframe and OAuth redirects must happen at top-level.
 */
export function login(options: LoginOptions): void {
  if (typeof window === 'undefined') {
    return;
  }

  const provider = options.provider.trim();
  if (!provider) {
    return;
  }

  const message = {
    type: 'SHELLUI_LOGIN',
    payload: {
      method: 'oauth' as const,
      provider,
      redirectPath: options.redirectPath?.trim() || undefined,
    },
  };

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
