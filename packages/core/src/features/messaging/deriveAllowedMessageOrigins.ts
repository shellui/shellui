import { collectOriginsFromUrls, getLogger } from '@shellui/sdk';
import { getAdminContentUrl } from '../admin/config';
import type { ShellUIConfig } from '../config/types';

const logger = getLogger('shellcore');

function collectConfiguredMessageOrigins(config?: ShellUIConfig | null): string[] {
  const raw = config?.security?.allowedMessageOrigins;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const valid = new Set<string>();
  const invalid: string[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'string') {
      invalid.push(String(entry));
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      invalid.push(entry);
      continue;
    }
    const [origin] = collectOriginsFromUrls(trimmed);
    if (origin) {
      valid.add(origin);
    } else {
      invalid.push(trimmed);
    }
  }

  if (invalid.length > 0) {
    logger.warn(
      'Ignoring invalid security.allowedMessageOrigins entries (expected http(s) origins or URLs)',
      { invalid },
    );
  }

  return [...valid];
}

/** Origins permitted for inbound/outbound Shellui postMessage traffic on this host. */
export function deriveAllowedMessageOrigins(config?: ShellUIConfig | null): string[] {
  const urls: (string | undefined | null)[] = [
    config?.storage?.url,
    config?.storage?.filesUrl,
    getAdminContentUrl(config ?? undefined),
  ];

  for (const item of config?.administration?.navigation ?? []) {
    if (item.openIn === 'external') continue;
    urls.push(item.url);
  }

  for (const entry of config?.navigation ?? []) {
    if ('items' in entry) {
      for (const item of entry.items) {
        if (item.openIn === 'external') continue;
        urls.push(item.url);
        urls.push(item.settings);
      }
    } else {
      if (entry.openIn === 'external') continue;
      urls.push(entry.url);
      urls.push(entry.settings);
    }
  }

  const derived = collectOriginsFromUrls(...urls);
  const configured = collectConfiguredMessageOrigins(config);
  return [...new Set([...derived, ...configured])];
}
