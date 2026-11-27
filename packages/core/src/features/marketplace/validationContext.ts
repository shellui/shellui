import type { OverlayValidationContext } from '@shellui/sdk';
import urls from '../../constants/urls';
import { getAdminPath } from '../admin/config';
import type { NavigationItem, ShellUIConfig } from '../config/types';
import { isShellDevelopment } from '../security/urlAllowlist';

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function staticNavigationOrigins(items: readonly NavigationItem[]): Set<string> {
  const origins = new Set<string>();
  for (const item of items) {
    const origin = originOf(item.url);
    if (origin) origins.add(origin);
  }
  return origins;
}

/** First path segments the shell routes itself: every `urls` entry and the admin path. */
export function reservedShellPaths(config?: ShellUIConfig): string[] {
  return [...Object.values(urls), getAdminPath(config)];
}

/**
 * The context every overlay check shares: runtime installs, a layout read from localStorage,
 * and a layout read from identity. Production builds refuse `http://localhost`.
 */
export function createOverlayValidationContext(input: {
  config?: ShellUIConfig;
  staticItems?: readonly NavigationItem[];
  now?: string;
}): OverlayValidationContext {
  return {
    now: input.now ?? new Date().toISOString(),
    shellOrigin: typeof window !== 'undefined' ? window.location.origin : null,
    staticOrigins: staticNavigationOrigins(input.staticItems ?? []),
    reservedPaths: reservedShellPaths(input.config),
    allowLocalhost: isShellDevelopment(),
  };
}
