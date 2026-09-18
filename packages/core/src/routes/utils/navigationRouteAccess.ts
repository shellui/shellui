import type { NavigationItem } from '../../features/config/types';

export type NavigationRouteAccess =
  | { kind: 'allow' }
  | { kind: 'loading' }
  | { kind: 'login'; next: string }
  | { kind: 'forbidden' };

export type NavigationRouteAccessState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
};

/**
 * Client-side route access for navigation items. APIs remain the source of truth for
 * authorization; this is UX defense-in-depth for `requiresAuth` and `requiresStaff`.
 */
export const getNavigationRouteAccess = (
  item: NavigationItem,
  state: NavigationRouteAccessState,
  nextPath: string,
): NavigationRouteAccess => {
  if (item.requiresAuth) {
    if (state.isLoading) {
      return { kind: 'loading' };
    }
    if (!state.isAuthenticated) {
      return { kind: 'login', next: nextPath };
    }
  }

  if (item.requiresStaff) {
    if (state.isLoading) {
      return { kind: 'loading' };
    }
    if (!state.isAuthenticated || !state.isStaff) {
      return { kind: 'forbidden' };
    }
  }

  return { kind: 'allow' };
};
