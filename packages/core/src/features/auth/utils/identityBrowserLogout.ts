import type { NavigationGroup, NavigationItem } from '../../config/types';
import urls from '../../../constants/urls';
import { flattenNavigationItems, getNavPathPrefix } from '../../layouts/utils';
import { SILENT_AUTH_QUERY, SILENT_AUTH_STATE_QUERY } from '../appBackend/silentSignIn';
import { SHELLUI_AUTH_CODE_PARAM } from '../constants/oauth';
import { WEB_PKCE_FLOW_PARAM } from './webPkce';

/**
 * Query keys that must not ride along on `return_to`.
 * A leftover `shellui_auth_code` would be exchanged again after identity sends
 * the browser back, which signs the user in and can start another logout.
 */
const RETURN_TO_STRIP_PARAMS = [
  SHELLUI_AUTH_CODE_PARAM,
  WEB_PKCE_FLOW_PARAM,
  'shellui_oauth_error',
  'shellui_oauth_error_code',
  SILENT_AUTH_QUERY,
  SILENT_AUTH_STATE_QUERY,
  'access_token',
  'refresh_token',
  'code_verifier',
] as const;

const stripReturnToParams = (url: URL) => {
  for (const key of RETURN_TO_STRIP_PARAMS) url.searchParams.delete(key);
  // Identity drops fragments before the allowlist check, so the landing URL
  // would not include one. Leave it off the request.
  url.hash = '';
};

/**
 * Absolute http(s) URL on `origin`, or null when `value` points somewhere else.
 */
export const sameOriginAppUrl = (origin: string, value: string): string | null => {
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  stripReturnToParams(url);
  return url.toString();
};

const leavesProtectedRoute = (
  pathname: string,
  navigation: (NavigationItem | NavigationGroup)[] | undefined,
): boolean => {
  const required = flattenNavigationItems(navigation ?? []).filter((item) => item.requiresAuth);
  return required.some((item) => {
    const pathPrefix = getNavPathPrefix(item);
    return (
      pathname === pathPrefix || pathname.startsWith(`${pathPrefix === '/' ? '' : pathPrefix}/`)
    );
  });
};

/**
 * Where the browser should land after identity logout.
 * Protected routes and `/login/callback` use the shell origin root, matching
 * the account-menu sign-out that leaves a guarded page before the session ends.
 * An explicit `returnTo` (a shell path or same-origin URL) wins.
 */
export const resolveLogoutReturnTo = (input: {
  origin: string;
  pathname: string;
  search: string;
  navigation?: (NavigationItem | NavigationGroup)[];
  returnTo?: string;
}): string | null => {
  const explicit = input.returnTo?.trim();
  if (explicit) return sameOriginAppUrl(input.origin, explicit);

  const pathname = input.pathname || '/';
  if (
    pathname === urls.loginCallback ||
    pathname.startsWith(`${urls.loginCallback}/`) ||
    leavesProtectedRoute(pathname, input.navigation)
  ) {
    return sameOriginAppUrl(input.origin, '/');
  }

  const rawSearch = input.search.startsWith('?') ? input.search.slice(1) : input.search;
  const search = rawSearch ? `?${rawSearch}` : '';
  return sameOriginAppUrl(input.origin, `${pathname}${search}`);
};

const isHttpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
};

/**
 * `logout_url` from `GET /api/v1/settings`, as an http(s) URL with no userinfo.
 * Anything else is treated as an older identity service with no browser logout.
 */
export const readIdentityLogoutUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const url = isHttpUrl(value.trim());
  if (!url) return null;
  url.hash = '';
  return url.toString();
};

/**
 * Top-level GET `logout_url?company_id=&return_to=`.
 * `return_to` is encoded once so `&`, `+`, and spaces survive the redirect.
 */
export const buildIdentityBrowserLogoutUrl = (
  logoutUrl: string,
  companyId: string,
  returnTo: string,
): string | null => {
  const company = companyId.trim();
  if (!/^\d+$/.test(company)) return null;
  const base = isHttpUrl(logoutUrl.trim());
  const target = isHttpUrl(returnTo.trim());
  if (!base || !target) return null;

  const params = new URLSearchParams(base.search);
  params.set('company_id', company);
  params.set('return_to', target.toString());
  base.search = params.toString();
  base.hash = '';
  return base.toString();
};

export type ShellSignOutActions = {
  /** `POST /api/v1/logout` with the Bearer token. Runs before local cleanup. */
  revoke: () => Promise<void>;
  clearLocal: () => void;
  /** Null when settings have no `logout_url` (older identity). */
  readBrowserLogoutUrl: () => Promise<string | null>;
  navigate: (url: string) => void;
  /**
   * False for a tab that only mirrored a sign-out, and for a frame that is not
   * the top window. Those paths clear tokens and do not navigate.
   */
  initiatedHere: boolean;
};

/**
 * Bearer revoke, then local tokens, then optional identity browser navigation.
 * Returns true when this call navigated.
 */
export const finishShellSignOut = async (actions: ShellSignOutActions): Promise<boolean> => {
  try {
    await actions.revoke();
  } catch {
    // A failed revoke still ends the local session.
  }
  actions.clearLocal();
  if (!actions.initiatedHere) return false;

  let url: string | null = null;
  try {
    url = await actions.readBrowserLogoutUrl();
  } catch {
    url = null;
  }
  if (!url) return false;
  actions.navigate(url);
  return true;
};
