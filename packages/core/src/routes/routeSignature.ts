import { getAdminPath } from '../features/admin/config';
import type { ShellUIConfig } from '../features/config/types';
import { flattenNavigationItems } from '../features/layouts/utils';

/**
 * Everything `createRoutes` reads from the config. The router is rebuilt only when this
 * changes, so hiding, showing, or reordering a navigation item (which changes the list the
 * layout renders, not the set of routes) does not tear down the router and the open frames.
 */
export function routeSignature(config: ShellUIConfig): string {
  const paths = [
    ...new Set(flattenNavigationItems(config.navigation ?? []).map((item) => item.path)),
  ].sort();
  return JSON.stringify({
    paths,
    admin: getAdminPath(config),
    layout: config.layout ?? null,
    title: config.title ?? null,
    appIcon: config.appIcon ?? null,
    logo: config.logo ?? null,
    hasNavigation: (config.navigation ?? []).length > 0,
  });
}
