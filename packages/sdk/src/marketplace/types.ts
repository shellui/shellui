import type { AppCapability } from './capabilities.js';

/** App record returned by `shellui.marketplace.listInstalledApps`. */
export interface MarketplaceAppInfo {
  id: string;
  name: string;
  origin: string;
  url: string;
  path: string;
  icon?: string;
  thirdParty: boolean;
  capabilities: AppCapability[];
  installedAt: string;
  updatedAt: string;
}

/**
 * Install request from the Shellui Marketplace frame.
 * `auth`, `safeForAuthToken`, and `childFrames` are ignored for third-party apps.
 */
export interface MarketplaceInstallRequest {
  id: string;
  name: string;
  url: string;
  path?: string;
  icon?: string;
  thirdParty?: boolean;
  capabilities?: string[];
  childFrames?: unknown;
  safeForAuthToken?: boolean;
}

export type MarketplaceResult<T> = ({ ok: true } & T) | { ok: false; error: string };
