import urls from '../../constants/urls';
import type { NavigationItem, ShellUIConfig } from '../config/types';
import { getAdminPath } from '../admin/config';
import { getNavPathPrefix } from './utils';

const toAbsoluteUrl = (url: string): URL | null => {
  try {
    return new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    );
  } catch {
    return null;
  }
};

const normalizeShellPath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing || '/';
};

const matchesAllowedShellPath = (pathname: string, allowedPrefixes: string[]): boolean => {
  const normalized = normalizeShellPath(pathname);
  if (normalized === '/') return true;
  return allowedPrefixes.some((prefix) => {
    if (prefix === '/') return normalized === '/';
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  });
};

/** Shell path prefixes registered in the router (built-in routes, config navigation, admin). */
export function getAllowedShellPathPrefixes(
  config: ShellUIConfig | undefined,
  navigationItems: NavigationItem[],
): string[] {
  const builtIn = Object.values(urls) as string[];
  const navPrefixes = navigationItems.map(getNavPathPrefix);
  const adminPath = getAdminPath(config);
  return [...new Set(['/', ...builtIn, adminPath, ...navPrefixes].map(normalizeShellPath))];
}

/**
 * Resolve an SDK navigate URL to a shell router path.
 * Only relative shell paths are accepted — external URLs are rejected.
 */
export function resolveSdkNavigatePath(
  rawUrl: string,
  config: ShellUIConfig | undefined,
  navigationItems: NavigationItem[],
): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return null;
  }

  const parsed = toAbsoluteUrl(trimmed);
  if (!parsed) return null;

  const allowedPrefixes = getAllowedShellPathPrefixes(config, navigationItems);
  if (matchesAllowedShellPath(parsed.pathname, allowedPrefixes)) {
    return `${parsed.pathname}${parsed.search}` || '/';
  }
  return null;
}
