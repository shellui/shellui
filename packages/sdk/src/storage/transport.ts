import { generateUuid } from '../utils/uuid.js';
import type { ShellUIMessage } from '../types.js';
import { StorageError } from './types.js';
import type { StorageRequestInput, StorageResponse, StorageResponsePayload } from './types.js';

export const STORAGE_REQUEST_TIMEOUT_MS = 120_000;

export type StorageTransport = {
  request: <T>(payload: StorageRequestInput) => Promise<StorageResponse<T>>;
};

type StorageMessageSdk = {
  addMessageListener: (
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void,
  ) => () => void;
};

function postStorageMessage(message: { type: string; payload: unknown }): void {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
    return;
  }
  window.postMessage(message, '*');
}

export function createPostMessageTransport(
  sdk: StorageMessageSdk,
  timeoutMs = STORAGE_REQUEST_TIMEOUT_MS,
): StorageTransport {
  return {
    request: <T>(payload: StorageRequestInput): Promise<StorageResponse<T>> => {
      if (typeof window === 'undefined') {
        return Promise.resolve({
          data: null,
          error: new StorageError('Window is undefined', 0),
        });
      }

      const id = generateUuid();
      return new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => {
          cleanup();
          resolve({
            data: null,
            error: new StorageError('Storage request timed out', 408),
          });
        }, timeoutMs);

        const cleanup = sdk.addMessageListener('SHELLUI_STORAGE_RESPONSE', (message) => {
          const response = message.payload as StorageResponsePayload | undefined;
          if (!response || response.id !== id) return;
          window.clearTimeout(timeoutId);
          cleanup();
          if (response.error) {
            resolve({
              data: null,
              error: new StorageError(
                response.error.message,
                response.error.status,
                response.error.code,
              ),
            });
            return;
          }
          resolve({ data: (response.data as T) ?? null, error: null });
        });

        postStorageMessage({
          type: 'SHELLUI_STORAGE_REQUEST',
          payload: { id, ...payload },
        });
      });
    },
  };
}
