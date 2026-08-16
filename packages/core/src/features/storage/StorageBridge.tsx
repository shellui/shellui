import { useEffect } from 'react';
import { shellui, type ShellUIMessage, type StorageRequestPayload } from '@shellui/sdk';
import { useAuth } from '../auth/hooks/useAuth';
import { useConfig } from '../config/useConfig';
import { handleStorageRequest } from './handleRequest';
import { getStorageBaseUrl } from './quota';
import { handleTrackedUpload, isUploadPayload } from './uploads/handleTrackedUpload';

/**
 * Root-window bridge: iframe `SHELLUI_STORAGE_REQUEST` messages are handled here
 * with `storage.url` and the signed-in user's access token.
 */
export const StorageBridge = () => {
  const { config } = useConfig();
  const { session } = useAuth();
  const storageUrl = getStorageBaseUrl(config);
  const accessToken = session?.accessToken ?? null;

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const listener = (message: ShellUIMessage) => {
      const payload = message.payload as StorageRequestPayload | undefined;
      if (!payload?.id || !payload.op) return;

      const run = isUploadPayload(payload)
        ? handleTrackedUpload({ storageUrl, accessToken, payload })
        : handleStorageRequest({ storageUrl, accessToken, payload });

      void run.then((response) => {
        const reply = {
          type: 'SHELLUI_STORAGE_RESPONSE' as const,
          payload: response,
        };
        const from = message.from?.filter(Boolean) as string[] | undefined;
        if (from?.length) {
          shellui.sendMessage({ ...reply, to: from });
          return;
        }
        window.postMessage(reply, '*');
      });
    };

    return shellui.addMessageListener('SHELLUI_STORAGE_REQUEST', listener);
  }, [storageUrl, accessToken]);

  return null;
};
