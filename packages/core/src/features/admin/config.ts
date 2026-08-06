import urls from '../../constants/urls';
import type { ShellUIConfig } from '../config/types';

export const DEFAULT_ADMIN_URL = 'https://admin.shellui.com';

/** Shell route path for the embedded admin panel. */
export function getAdminPath(config?: ShellUIConfig): string {
  const configured = config?.backend?.adminPathname?.trim();
  return configured && configured.startsWith('/') ? configured : urls.admin;
}

/** Iframe content URL for the admin panel (config override or production default). */
export function getAdminContentUrl(config?: ShellUIConfig): string {
  return config?.backend?.adminUrl?.trim() || DEFAULT_ADMIN_URL;
}
