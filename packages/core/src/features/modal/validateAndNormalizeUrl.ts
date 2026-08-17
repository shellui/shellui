import { getAdminContentUrl } from '../admin/config';
import type { ShellUIConfig } from '../config/types';

const originFromAbsoluteUrl = (value: string | undefined | null): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

/** Origins allowed in modal iframes: storage service/files app, admin panel, and administration nav apps. */
const getAllowedModalOrigins = (config?: ShellUIConfig | null): Set<string> => {
  const origins = new Set<string>();
  const add = (value?: string | null) => {
    const origin = originFromAbsoluteUrl(value);
    if (origin) {
      origins.add(origin);
    }
  };

  add(config?.storage?.url);
  add(config?.storage?.filesUrl);
  add(getAdminContentUrl(config ?? undefined));

  for (const item of config?.administration?.navigation ?? []) {
    if (item.openIn === 'external') {
      continue;
    }
    add(item.url);
  }

  return origins;
};

/**
 * Validates and normalizes a URL to ensure it's from the same domain, localhost,
 * storage, or administration origins configured on the host.
 * @param url - The URL or path to validate
 * @param config - Host config used to allow storage and administration origins
 * @returns The normalized absolute URL or null if invalid
 */
export const validateAndNormalizeUrl = (
  url: string | undefined | null,
  config?: ShellUIConfig | null,
): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // If it's already an absolute URL, check if it's same origin, localhost, or trusted
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      // Allow same origin
      if (urlObj.origin === currentOrigin) {
        return url;
      }

      // Allow localhost URLs (for development)
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return url;
      }

      if (getAllowedModalOrigins(config).has(urlObj.origin)) {
        return url;
      }

      return null; // Different origin, reject for security
    }

    // If it's a relative URL, make it absolute using current origin
    if (url.startsWith('/') || url.startsWith('./') || !url.startsWith('//')) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      // Ensure relative paths start with /
      const normalizedPath = url.startsWith('/') ? url : `/${url}`;
      return `${currentOrigin}${normalizedPath}`;
    }

    // Reject protocol-relative URLs (//example.com) for security
    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Invalid URL:', url, error);
    return null;
  }
};
