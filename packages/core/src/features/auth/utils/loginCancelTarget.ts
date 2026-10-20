import type { NavigationGroup, NavigationItem } from '../../config/types';
import {
  findMatchingNavigationItem,
  flattenNavigationItems,
  getNavPathPrefix,
  isLoginNavigationUrl,
} from '../../layouts/utils';

type CancelTargetConfig = {
  navigation?: (NavigationItem | NavigationGroup)[];
  start_url?: string;
};

/** A nav item a signed-out user can open as a page in the main area. */
export function isPublicNavigationPage(item: NavigationItem): boolean {
  if (item.requiresAuth || item.requiresStaff || item.hideWhenLoggedOut) return false;
  if (item.requiresDevMode || item.hidden) return false;
  if (item.openIn && item.openIn !== 'default') return false;
  return !isLoginNavigationUrl(item.url);
}

/**
 * Where the login page Cancel button should go, or `null` to hide it.
 * Prefers `/` (or `start_url`) when public, else the first public nav page.
 * `/` without a root item or `start_url` shows the built-in HomeView, which is public.
 */
export function getLoginCancelTarget(config: CancelTargetConfig | undefined): string | null {
  const items = flattenNavigationItems(config?.navigation ?? []);
  const startUrl = config?.start_url?.trim();
  const landing = startUrl ? (startUrl.startsWith('/') ? startUrl : `/${startUrl}`) : '/';
  const landingPath = landing.split(/[?#]/)[0] || '/';

  const landingItem = findMatchingNavigationItem(items, landingPath);
  if (!landingItem) {
    // No nav item owns the landing path: HomeView or a built-in shell route.
    if (!startUrl || !isLoginNavigationUrl(landingPath)) return '/';
  } else if (isPublicNavigationPage(landingItem)) {
    return '/';
  }

  const fallback = items.find(
    (item) => item !== landingItem && item.path !== '' && isPublicNavigationPage(item),
  );
  return fallback ? getNavPathPrefix(fallback) : null;
}
