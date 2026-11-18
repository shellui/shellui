import { useEffect } from 'react';
import {
  postShellMessage,
  shellui,
  type ShellUIMessage,
  type StorageRequestPayload,
} from '@shellui/sdk';
import { ensureAppBackendSession } from '../auth/appBackend/appBackendSessions';
import { findChildFrame } from '../auth/appBackend/childFrames';
import { useAuth } from '../auth/hooks/useAuth';
import { useConfig } from '../config/useConfig';
import { getStorageRequestTrustDenial } from '../security/trustedFrames';
import { handleStorageRequest } from './handleRequest';
import { getStorageBaseUrl } from './quota';
import { resolveStorageBridgeTarget } from './resolveStorageBridgeTarget';
import { handleTrackedUpload, isUploadPayload } from './uploads/handleTrackedUpload';

/**
 * Root-window bridge: iframe `SHELLUI_STORAGE_REQUEST` messages are handled here.
 * A nested app (dashboard admin, then Files) uses the storage URL and regional
 * session registered for that frame. A frame the shell hosts directly uses
 * `storage.url` from shellui.config and the shell session.
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

      const trustDenial = getStorageRequestTrustDenial(message.from, shellui.frameRegistry, config);
      if (trustDenial) {
        const response = { id: payload.id, error: trustDenial };
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
        return;
      }

      const run = (async () => {
        const child = findChildFrame(message.from ?? []);
        const nested = child
          ? {
              storageUrl: child.services.storage,
              accessToken: child.identity
                ? await ensureAppBackendSession(child.identity, { allowSilent: true })
                : null,
            }
          : null;
        const target = resolveStorageBridgeTarget(nested, { storageUrl, accessToken });
        const input = {
          storageUrl: target.storageUrl,
          accessToken: target.accessToken,
          payload,
        };
        return isUploadPayload(payload) ? handleTrackedUpload(input) : handleStorageRequest(input);
      })();

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
        postShellMessage(reply);
      });
    };

    return shellui.addMessageListener('SHELLUI_STORAGE_REQUEST', listener);
  }, [storageUrl, accessToken, config]);

  return null;
};
