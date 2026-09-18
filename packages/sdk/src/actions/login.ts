import type { LoginOptions } from '../types.js';
import { postShellMessage } from '../utils/postShellMessage.js';

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

  postShellMessage(message);
}
