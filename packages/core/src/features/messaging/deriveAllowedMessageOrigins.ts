import { collectOriginsFromUrls } from '@shellui/sdk';
import { getAdminContentUrl } from '../admin/config';
import type { ShellUIConfig } from '../config/types';

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

  return collectOriginsFromUrls(...urls);
}
