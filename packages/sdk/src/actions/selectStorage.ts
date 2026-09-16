import { shellui } from '../index.js';
import { generateUuid } from '../utils/uuid.js';
import type {
  StorageSelectMode,
  StorageSelectOptions,
  StorageSelectRequestPayload,
  StorageSelectResponsePayload,
  StorageSelectResult,
} from '../types.js';

function postSelectMessage(payload: StorageSelectRequestPayload): void {
  const message = {
    type: 'SHELLUI_SELECT_STORAGE',
    payload,
  };
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
    return;
  }
  window.postMessage(message, '*');
}

function normalizeMode(options: StorageSelectOptions = {}): StorageSelectMode {
  return options.mode === 'files' || options.mode === 'any' ? options.mode : 'folders';
}

/**
 * Open the storage picker in a Shellui modal. Resolves with selected items,
 * or `null` if the user cancelled.
 */
export function selectStorage(
  options: StorageSelectOptions = {},
): Promise<StorageSelectResult | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  const id = generateUuid();
  const payload: StorageSelectRequestPayload = {
    id,
    multiple: Boolean(options.multiple),
    mode: normalizeMode(options),
  };

  return new Promise((resolve, reject) => {
    const cleanup = shellui.addMessageListener('SHELLUI_SELECT_STORAGE_RESULT', (message) => {
      const response = message.payload as StorageSelectResponsePayload | undefined;
      if (!response || response.id !== id) return;
      cleanup();
      if (response.error) {
        reject(new Error(response.error.message));
        return;
      }
      if (response.cancelled) {
        resolve(null);
        return;
      }
      resolve({ items: response.items ?? [] });
    });

    postSelectMessage(payload);
  });
}

/** Pick one or more folders. Files are not selectable. */
export function selectFolders(
  options: { multiple?: boolean } = {},
): Promise<StorageSelectResult | null> {
  return selectStorage({ multiple: options.multiple, mode: 'folders' });
}

/**
 * Pick files. Pass `{ folders: true }` to also allow folders.
 */
export function selectFiles(
  options: { multiple?: boolean; folders?: boolean } = {},
): Promise<StorageSelectResult | null> {
  return selectStorage({
    multiple: options.multiple,
    mode: options.folders ? 'any' : 'files',
  });
}
