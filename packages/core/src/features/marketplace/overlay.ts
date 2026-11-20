import { sanitizeCapabilityList, type AppCapability } from '@shellui/sdk';
import { isLocalDevHost, safeRemoteIconUrl } from './icons';
import { NAVIGATION_OVERLAY_VERSION } from './normalizeMarketplaceConfig';

export interface InstalledAppRecord {
  id: string;
  name: string;
  origin: string;
  url: string;
  path: string;
  icon?: string;
  thirdParty: boolean;
  capabilities: AppCapability[];
  installedAt: string;
  updatedAt: string;
}

export interface NavigationOverlay {
  version: 1;
  installedApps: InstalledAppRecord[];
  order: string[];
  hiddenPaths: string[];
  updatedAt: string;
}

export interface NavigationStorageAdapter {
  load(): Promise<NavigationOverlay | null>;
  save(overlay: NavigationOverlay): Promise<void>;
  reset?(): Promise<void>;
}

export function emptyNavigationOverlay(now = new Date().toISOString()): NavigationOverlay {
  return {
    version: NAVIGATION_OVERLAY_VERSION,
    installedApps: [],
    order: [],
    hiddenPaths: [],
    updatedAt: now,
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Drop auth, child frames, and inline icons from a stored app. Invalid apps are omitted. */
export function sanitizeInstalledApp(value: unknown, now: string): InstalledAppRecord | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  const path = typeof value.path === 'string' ? value.path.trim().replace(/^\/+|\/+$/g, '') : '';
  if (!id || !name || !url || !path) return null;
  let origin = '';
  try {
    const parsed = new URL(url);
    const localhost = isLocalDevHost(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localhost)) return null;
    origin = parsed.origin;
  } catch {
    return null;
  }
  const thirdParty = value.thirdParty !== false;
  const capabilities = sanitizeCapabilityList(
    Array.isArray(value.capabilities) ? value.capabilities : [],
    thirdParty,
  );
  const icon = safeRemoteIconUrl(value.icon);
  const installedAt = typeof value.installedAt === 'string' ? value.installedAt : now;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : now;
  return {
    id,
    name,
    origin,
    url,
    path,
    ...(icon ? { icon } : {}),
    thirdParty,
    capabilities,
    installedAt,
    updatedAt,
  };
}

export function parseNavigationOverlay(
  raw: unknown,
  now = new Date().toISOString(),
): NavigationOverlay | null {
  const payload = isRecord(raw) && 'overlay' in raw && isRecord(raw.overlay) ? raw.overlay : raw;
  if (!isRecord(payload)) return null;
  if (payload.version !== NAVIGATION_OVERLAY_VERSION) return null;
  const installedApps = Array.isArray(payload.installedApps)
    ? payload.installedApps
        .map((entry) => sanitizeInstalledApp(entry, now))
        .filter((entry): entry is InstalledAppRecord => entry !== null)
    : [];
  const seen = new Set<string>();
  const uniqueApps = installedApps.filter((app) => {
    if (seen.has(app.id)) return false;
    seen.add(app.id);
    return true;
  });
  return {
    version: NAVIGATION_OVERLAY_VERSION,
    installedApps: uniqueApps,
    order: stringList(payload.order),
    hiddenPaths: stringList(payload.hiddenPaths),
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : now,
  };
}

export function overlayHasContent(overlay: NavigationOverlay | null | undefined): boolean {
  if (!overlay) return false;
  return (
    overlay.installedApps.length > 0 || overlay.order.length > 0 || overlay.hiddenPaths.length > 0
  );
}
