import type { ShellUIConfig } from '../config/types';
import { isAdminFrame } from '../admin/utils';
import { flattenNavigationItems, isFrameForAppUrl } from '../layouts/utils';

/** Minimal frame registry surface for trust checks (shared with #60 message gating). */
export type FrameRegistryLike = {
  getAllIframes(): Array<[string, HTMLIFrameElement]>;
};

/**
 * Whether an iframe `src` is trusted for privileged shell features (JWT sharing,
 * StorageBridge). Navigation companions require `safeForAuthToken: true` (opt-in).
 * First-party admin URLs and `storage.filesUrl` remain trusted by default.
 */
export function isTrustedFrameForAuthToken(frameSrc: string, config?: ShellUIConfig): boolean {
  if (isAdminFrame(frameSrc, config)) {
    return true;
  }

  const adminNavItems = config?.administration?.navigation ?? [];
  if (
    adminNavItems.some(
      (item) =>
        item.openIn !== 'external' &&
        Boolean(item.url?.trim()) &&
        isFrameForAppUrl(frameSrc, item.url),
    )
  ) {
    return true;
  }

  const filesUrl = config?.storage?.filesUrl?.trim();
  if (filesUrl && isFrameForAppUrl(frameSrc, filesUrl)) {
    return true;
  }

  const navigationItems = flattenNavigationItems(config?.navigation ?? []);
  return navigationItems.some(
    (item) => item.safeForAuthToken === true && isFrameForAppUrl(frameSrc, item.url),
  );
}

/** Resolve the registered immediate sender iframe `src` from a postMessage `from` chain. */
export function resolveRegisteredFrameSrc(
  from: string[] | undefined,
  frameRegistry: FrameRegistryLike,
): string | null {
  const iframeUuid = from?.find(Boolean);
  if (!iframeUuid) {
    return null;
  }

  const frame = frameRegistry.getAllIframes().find(([uuid]) => uuid === iframeUuid)?.[1];
  const frameSrc = frame?.src?.trim();
  return frameSrc || null;
}

/** Whether a registered frame `src` passes the trusted-frame policy. */
export function isRegisteredTrustedFrame(frameSrc: string | null, config?: ShellUIConfig): boolean {
  return Boolean(frameSrc && isTrustedFrameForAuthToken(frameSrc, config));
}

export type StorageTrustDenial = { message: string; status: 403 };

/**
 * Returns a storage error when the request sender is missing from the frame
 * registry or fails the trusted-frame policy. Call before any storage I/O.
 */
export function getStorageRequestTrustDenial(
  from: string[] | undefined,
  frameRegistry: FrameRegistryLike,
  config?: ShellUIConfig,
): StorageTrustDenial | null {
  const frameSrc = resolveRegisteredFrameSrc(from, frameRegistry);
  if (!isRegisteredTrustedFrame(frameSrc, config)) {
    return { message: 'Storage request rejected: untrusted frame', status: 403 };
  }
  return null;
}

export type AiTrustDenial = { message: string; code: 'untrusted_frame' };

/**
 * Returns an AI error when the request sender is missing from the frame
 * registry or fails the trusted-frame policy (same opt-in as JWT / storage).
 */
export function getAiRequestTrustDenial(
  from: string[] | undefined,
  frameRegistry: FrameRegistryLike,
  config?: ShellUIConfig,
): AiTrustDenial | null {
  const frameSrc = resolveRegisteredFrameSrc(from, frameRegistry);
  if (!isRegisteredTrustedFrame(frameSrc, config)) {
    return { message: 'AI request rejected: untrusted frame', code: 'untrusted_frame' };
  }
  return null;
}
