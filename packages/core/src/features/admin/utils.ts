import type { ShellUIConfig } from '../config/types';
import { getBaseUrlWithoutHash, isFrameForAppUrl } from '../layouts/utils';
import { getAdminContentUrl, getAdminPath } from './config';

/** Whether an iframe src belongs to the embedded admin microfrontend. */
export function isAdminFrame(frameSrc: string, config?: ShellUIConfig): boolean {
  return isFrameForAppUrl(frameSrc, getAdminContentUrl(config));
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
