import { shellui, type FrameCapabilityGrantInput } from '@shellui/sdk';
import type { ShellUIConfig } from '../config/types';
import { removeChildFramesForHosts } from '../auth/appBackend/childFrames';
import { deriveAllowedMessageOrigins } from '../messaging/deriveAllowedMessageOrigins';
import type { NavigationEntry } from './mergeNavigation';
import type { InstalledAppRecord } from './overlay';

export function grantsFromInstalledApps(
  apps: readonly InstalledAppRecord[],
): FrameCapabilityGrantInput[] {
  const grouped = new Map<string, FrameCapabilityGrantInput>();
  for (const app of apps) {
    const current = grouped.get(app.origin);
    if (!current) {
      grouped.set(app.origin, {
        origin: app.origin,
        thirdParty: app.thirdParty,
        capabilities: [...app.capabilities],
        urls: [app.url],
      });
      continue;
    }
    const thirdParty = current.thirdParty || app.thirdParty;
    const capabilities = current.capabilities.filter((capability) =>
      app.capabilities.includes(capability as InstalledAppRecord['capabilities'][number]),
    );
    grouped.set(app.origin, {
      origin: app.origin,
      thirdParty,
      capabilities: thirdParty
        ? ['theme', 'locale', ...capabilities.filter((capability) => capability !== 'auth')]
        : capabilities,
      urls: [...current.urls, app.url],
    });
  }
  return [...grouped.values()];
}

/** Recompute the postMessage allowlist and drop frames for apps that were removed. */
export function applyNavigationMessageSecurity(input: {
  config: ShellUIConfig;
  navigation: readonly NavigationEntry[];
  apps: readonly InstalledAppRecord[];
  marketplaceOrigin: string | null;
  removedAppUrls: readonly string[];
}): string[] {
  shellui.configureMessageSecurity({
    allowedOrigins: deriveAllowedMessageOrigins({
      ...input.config,
      navigation: [...input.navigation],
    }),
    marketplaceOrigin: input.marketplaceOrigin,
  });
  shellui.frameRegistry.setCapabilityGrants(grantsFromInstalledApps(input.apps));
  const removedIds: string[] = [];
  for (const url of input.removedAppUrls) {
    removedIds.push(...shellui.frameRegistry.unregisterFramesForUrl(url));
  }
  if (removedIds.length > 0) removeChildFramesForHosts(removedIds);
  return removedIds;
}
