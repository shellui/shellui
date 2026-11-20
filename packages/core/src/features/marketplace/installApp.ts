import {
  GRANTABLE_EXTRA_CAPABILITIES,
  sanitizeCapabilityList,
  type AppCapability,
} from '@shellui/sdk';
import type { NavigationItem } from '../config/types';
import { isLocalDevHost, safeRemoteIconUrl } from './icons';
import type { InstalledAppRecord } from './overlay';

export interface MarketplaceInstallRequest {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  path?: unknown;
  icon?: unknown;
  thirdParty?: unknown;
  capabilities?: unknown;
  childFrames?: unknown;
  safeForAuthToken?: unknown;
}

export interface InstallSummary {
  name: string;
  origin: string;
  capabilities: AppCapability[];
  /** True when the request asked for sign-in or child frames. Those are not granted. */
  deniedPrivileged: boolean;
}

export type InstallPreparation =
  | { ok: false; error: string }
  | {
      ok: true;
      needsConfirmation: boolean;
      record: InstalledAppRecord;
      summary: InstallSummary;
    };

const EXTRA = new Set<string>(GRANTABLE_EXTRA_CAPABILITIES);

function normalizePath(value: unknown, fallbackId: string): string | null {
  const raw = typeof value === 'string' && value.trim() ? value : fallbackId;
  const path = raw
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/-+/g, '-');
  if (!path || path.includes('..')) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,120}$/.test(path)) return null;
  return path;
}

function allocatePath(desired: string, taken: ReadonlySet<string>): string {
  if (!taken.has(desired)) return desired;
  let n = 2;
  while (taken.has(`${desired}-${n}`)) n += 1;
  return `${desired}-${n}`;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function prepareInstall(
  request: MarketplaceInstallRequest,
  options: {
    allowThirdParty: boolean;
    now: string;
    takenPaths: ReadonlySet<string>;
    staticOrigins: ReadonlySet<string>;
    shellOrigin?: string | null;
  },
): InstallPreparation {
  const id = typeof request.id === 'string' ? request.id.trim() : '';
  const name = typeof request.name === 'string' ? request.name.trim() : '';
  const url = typeof request.url === 'string' ? request.url.trim() : '';
  if (!id || !name || !url) return { ok: false, error: 'invalid_request' };
  if (id.length > 128 || name.length > 80) return { ok: false, error: 'invalid_request' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
  const localhost = isLocalDevHost(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localhost)) {
    return { ok: false, error: 'invalid_request' };
  }

  const thirdParty = request.thirdParty !== false;
  if (thirdParty && !options.allowThirdParty) return { ok: false, error: 'third_party_disabled' };
  if (thirdParty && options.shellOrigin && parsed.origin === options.shellOrigin) {
    return { ok: false, error: 'origin_in_use' };
  }
  if (thirdParty && options.staticOrigins.has(parsed.origin)) {
    return { ok: false, error: 'origin_in_use' };
  }

  const desired = normalizePath(request.path, id);
  if (!desired) return { ok: false, error: 'invalid_request' };
  const path = allocatePath(desired, options.takenPaths);

  const requested = Array.isArray(request.capabilities) ? request.capabilities : [];
  const capabilities = sanitizeCapabilityList(
    ['theme', 'locale', ...requested.filter((entry) => entry !== 'auth')],
    thirdParty,
  );
  const askedForExtra = requested.some((entry) => typeof entry === 'string' && EXTRA.has(entry));
  const deniedPrivileged =
    requested.includes('auth') ||
    requested.includes('childFrames') ||
    requested.includes('safeForAuthToken') ||
    request.safeForAuthToken === true ||
    (request.childFrames !== undefined && request.childFrames !== null);

  const needsConfirmation = thirdParty || askedForExtra || deniedPrivileged;
  const icon = safeRemoteIconUrl(request.icon);
  const record: InstalledAppRecord = {
    id,
    name,
    origin: parsed.origin,
    url,
    path,
    ...(icon ? { icon } : {}),
    thirdParty,
    capabilities,
    installedAt: options.now,
    updatedAt: options.now,
  };

  return {
    ok: true,
    needsConfirmation,
    record,
    summary: {
      name,
      origin: parsed.origin,
      capabilities,
      deniedPrivileged,
    },
  };
}

export function upsertInstalledApp(
  apps: readonly InstalledAppRecord[],
  record: InstalledAppRecord,
): InstalledAppRecord[] {
  const existing = apps.find((app) => app.id === record.id);
  const next = existing
    ? { ...record, installedAt: existing.installedAt, path: existing.path }
    : record;
  return [...apps.filter((app) => app.id !== record.id), next];
}

export function staticNavigationOrigins(items: readonly NavigationItem[]): Set<string> {
  const origins = new Set<string>();
  for (const item of items) {
    const origin = originOf(item.url);
    if (origin) origins.add(origin);
  }
  return origins;
}
