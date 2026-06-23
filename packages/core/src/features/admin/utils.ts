import type { ShellUIConfig } from '../config/types';
import { getBaseUrlWithoutHash, getHashPathFromUrl } from '../layouts/utils';
import { getAdminContentUrl, getAdminPath } from './config';

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

const normalizePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing || '/';
};

const normalizeHashPath = (value: string): string => {
  return value.replace(/^#\/?/, '').replace(/\/+$/, '');
};

const isFrameForIframeUrl = (frameSrc: string, itemUrl: string): boolean => {
  const frame = toAbsoluteUrl(frameSrc);
  const item = toAbsoluteUrl(itemUrl);
  if (!frame || !item) return false;
  if (frame.origin !== item.origin) return false;

  const itemPathname = normalizePath(item.pathname);
  const framePathname = normalizePath(frame.pathname);
  if (framePathname !== itemPathname && !framePathname.startsWith(`${itemPathname}/`)) {
    return false;
  }

  const itemHashPath = normalizeHashPath(item.hash || getHashPathFromUrl(itemUrl));
  if (!itemHashPath) {
    return true;
  }

  const frameHashPath = normalizeHashPath(frame.hash);
  return frameHashPath === itemHashPath || frameHashPath.startsWith(`${itemHashPath}/`);
};

/** Whether an iframe src belongs to the embedded admin microfrontend. */
export function isAdminFrame(frameSrc: string, config?: ShellUIConfig): boolean {
  return isFrameForIframeUrl(frameSrc, getAdminContentUrl(config));
}

/** Admin microfrontend uses hash routes (e.g. createHashRouter); sync shell `/admin/...` with iframe `#/...`. */
export function buildAdminIframeSrc(
  baseAdminContentUrl: string,
  normalizedAdminPath: string,
  pathname: string,
  search: string,
): string {
  const pathAfterAdmin = pathname.startsWith(normalizedAdminPath)
    ? pathname.slice(normalizedAdminPath.length)
    : '';
  const segment = pathAfterAdmin.replace(/^\/+|\/+$/g, '');
  const hashRoute = segment ? `/${segment}` : '/';
  const originBase = getBaseUrlWithoutHash(baseAdminContentUrl).replace(/\/+$/, '');
  return `${originBase}/#${hashRoute}${search}`;
}

export function isAdminPath(pathname: string, config?: ShellUIConfig): boolean {
  const adminPath = getAdminPath(config);
  return pathname === adminPath || pathname.startsWith(`${adminPath}/`);
}

export function getDjangoAdminHref(config?: ShellUIConfig): string | null {
  if (config?.backend?.type !== 'shellui' || !config.backend.url?.trim()) {
    return null;
  }
  return `${config.backend.url.replace(/\/+$/, '')}/admin`;
}
