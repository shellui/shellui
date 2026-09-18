import type { ShellUIConfig } from '../config/types';

/** True when the shell is running a development build (localhost modal/panel exceptions apply). */
export const isShellDevelopment = (): boolean => process.env.NODE_ENV === 'development';

export const isLocalhostHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

export const originFromAbsoluteUrl = (value: string | undefined | null): string | null => {
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

const getConfiguredTrustedOrigins = (config?: ShellUIConfig | null): Set<string> => {
  const origins = new Set<string>();
  const add = (value?: string | null) => {
    const origin = originFromAbsoluteUrl(value);
    if (origin) {
      origins.add(origin);
    }
  };

  add(config?.backend?.url);
  add(config?.backend?.loginUrl);
  add(config?.storage?.url);
  add(config?.storage?.filesUrl);

  return origins;
};

export type UrlAllowlistOptions = {
  /** When true, loopback hostnames are allowed (development builds only). */
  allowLocalhost?: boolean;
  config?: ShellUIConfig | null;
  /** Current shell origin; required to allow same-origin absolute URLs. */
  currentOrigin?: string;
};

/**
 * Whether an absolute http(s) URL origin is allowed for iframe embedding (modal, login panel).
 * Relative paths are validated separately and resolve to the shell origin.
 */
export const isAllowedIframeOrigin = (
  origin: string,
  { allowLocalhost = false, config, currentOrigin = '' }: UrlAllowlistOptions = {},
): boolean => {
  if (currentOrigin && origin === currentOrigin) {
    return true;
  }

  if (allowLocalhost && isShellDevelopment()) {
    try {
      const { hostname } = new URL(origin);
      if (isLocalhostHostname(hostname)) {
        return true;
      }
    } catch {
      // fall through
    }
  }

  return getConfiguredTrustedOrigins(config).has(origin);
};

/**
 * Validates login branding `panelUrl` before loading it in an unsandboxed iframe.
 * Allows same-origin relative paths, same-origin absolute URLs, configured backend/login/storage
 * origins, and loopback URLs in development only. Rejects other schemes and origins.
 */
export const validateLoginPanelUrl = (
  url: string | undefined | null,
  config?: ShellUIConfig | null,
): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  // Relative paths resolve to the shell origin and are safe.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  try {
    const urlObj = new URL(trimmed);
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

    if (
      isAllowedIframeOrigin(urlObj.origin, {
        allowLocalhost: true,
        config,
        currentOrigin,
      })
    ) {
      return trimmed;
    }

    return null;
  } catch {
    return null;
  }
};
