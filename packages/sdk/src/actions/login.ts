import type { LoginOptions } from '../types.js';

/**
 * Requests login in the shell context.
 * Useful when nested in an iframe and OAuth redirects must happen at top-level.
 */
export function login(options: LoginOptions): void {
  if (typeof window === 'undefined') {
    return;
  }
  const message =
    options.method === 'web3'
      ? {
          type: 'SHELLUI_LOGIN',
          payload: {
            method: 'web3' as const,
            chain: options.chain ?? 'ethereum',
            redirectPath: options.redirectPath?.trim() || undefined,
          },
        }
      : (() => {
          const provider = options.provider?.trim();
          if (!provider) {
            return null;
          }
          return {
            type: 'SHELLUI_LOGIN',
            payload: {
              method: 'oauth' as const,
              provider,
              redirectPath: options.redirectPath?.trim() || undefined,
            },
          };
        })();
  if (!message) return;

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
