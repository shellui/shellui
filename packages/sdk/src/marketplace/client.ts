import { generateUuid } from '../utils/uuid.js';
import { postShellMessage } from '../utils/postShellMessage.js';
import type { ShellUIMessage } from '../types.js';
import type { AppCapability } from './capabilities.js';
import {
  MARKETPLACE_INSTALL,
  MARKETPLACE_INSTALL_RESULT,
  MARKETPLACE_LIST,
  MARKETPLACE_LIST_RESULT,
  MARKETPLACE_UNINSTALL,
  MARKETPLACE_UNINSTALL_RESULT,
} from './messages.js';
import type { MarketplaceAppInfo, MarketplaceInstallRequest } from './types.js';

const REQUEST_TIMEOUT_MS = 60_000;

type MarketplaceSdk = {
  addMessageListener: (
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void,
  ) => () => void;
};

type ResultPayload = {
  id?: string;
  ok?: boolean;
  error?: string;
  apps?: MarketplaceAppInfo[];
  app?: MarketplaceAppInfo;
};

function requestResult(
  sdk: MarketplaceSdk,
  type: string,
  resultType: string,
  payload: Record<string, unknown>,
): Promise<ResultPayload> {
  if (typeof window === 'undefined') {
    return Promise.resolve({ ok: false, error: 'window_unavailable' });
  }
  const id = generateUuid();
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({ ok: false, error: 'timeout' });
    }, REQUEST_TIMEOUT_MS);

    const cleanup = sdk.addMessageListener(resultType, (message) => {
      const body = message.payload as ResultPayload | undefined;
      if (!body || body.id !== id) return;
      window.clearTimeout(timeoutId);
      cleanup();
      resolve(body);
    });

    postShellMessage({ type, payload: { id, ...payload } });
  });
}

export type MarketplaceClient = {
  listInstalledApps: () => Promise<MarketplaceAppInfo[]>;
  installApp: (request: MarketplaceInstallRequest) => Promise<MarketplaceAppInfo>;
  uninstallApp: (appId: string) => Promise<void>;
};

export function createMarketplaceClient(sdk: MarketplaceSdk): MarketplaceClient {
  return {
    async listInstalledApps() {
      const result = await requestResult(sdk, MARKETPLACE_LIST, MARKETPLACE_LIST_RESULT, {});
      if (!result.ok) {
        throw new Error(result.error || 'marketplace_list_failed');
      }
      return Array.isArray(result.apps) ? result.apps : [];
    },
    async installApp(request: MarketplaceInstallRequest) {
      const result = await requestResult(sdk, MARKETPLACE_INSTALL, MARKETPLACE_INSTALL_RESULT, {
        request,
      });
      if (!result.ok || !result.app) {
        throw new Error(result.error || 'marketplace_install_failed');
      }
      return result.app;
    },
    async uninstallApp(appId: string) {
      const result = await requestResult(sdk, MARKETPLACE_UNINSTALL, MARKETPLACE_UNINSTALL_RESULT, {
        appId,
      });
      if (!result.ok) {
        throw new Error(result.error || 'marketplace_uninstall_failed');
      }
    },
  };
}

export type { AppCapability };
