import type { ShellUIConfig } from '../../config/types';
import { isAdminFrame } from '../../admin/utils';
import { isFrameForAppUrl } from '../../layouts/utils';
import { flattenNavigationItems } from './flattenNavigationItems';

const isFrameForNavigationItem = (frameSrc: string, itemUrl: string): boolean =>
  isFrameForAppUrl(frameSrc, itemUrl);

/**
 * Whether the shell may include the session access token in settings sent to this iframe.
 *
 * Navigation companions require `safeForAuthToken: true` (opt-in). First-party admin and
 * storage file explorer frames remain trusted by default.
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
        isFrameForNavigationItem(frameSrc, item.url),
    )
  ) {
    return true;
  }

  const filesUrl = config?.storage?.filesUrl?.trim();
  if (filesUrl && isFrameForNavigationItem(frameSrc, filesUrl)) {
    return true;
  }

  const navigationItems = config?.navigation ? flattenNavigationItems(config.navigation) : [];

  return navigationItems.some(
    (item) => item.safeForAuthToken === true && isFrameForNavigationItem(frameSrc, item.url),
  );
}
