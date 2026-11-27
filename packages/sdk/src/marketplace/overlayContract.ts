/**
 * The navigation overlay contract shared by the shell and identity-service.
 *
 * `packages/sdk/schemas/navigation-overlay.v1.json` is the same file as
 * `apps/authapi/schemas/navigation-overlay.v1.json` in identity-service, and a contract test
 * in each repo validates the same example against its own validator. One validator here serves
 * runtime installs, layouts read from localStorage, and layouts read from identity.
 */

import {
  APP_CAPABILITIES,
  GRANTABLE_EXTRA_CAPABILITIES,
  type AppCapability,
} from './capabilities.js';

export const NAVIGATION_OVERLAY_VERSION = 1 as const;

export const OVERLAY_LIMITS = {
  maxApps: 100,
  maxOrder: 200,
  maxHiddenPaths: 200,
  maxIdLength: 64,
  maxNameLength: 120,
  maxUrlLength: 2048,
  maxPathLength: 200,
  maxTimestampLength: 40,
  /** Serialized overlay size. identity-service answers 413 above this. */
  maxBytes: 64 * 1024,
} as const;

/** Capabilities a stored third-party app may carry. Never `auth`. */
export const THIRD_PARTY_CAPABILITIES: readonly AppCapability[] = [
  'theme',
  'locale',
  ...GRANTABLE_EXTRA_CAPABILITIES,
];

/**
 * First path segments an installed app can never take, compared case-insensitively.
 * The shell adds its own routes (`urls`, the admin path) on top. Keep in step with
 * `RESERVED_PATH_SEGMENTS` in identity-service.
 */
export const RESERVED_PATH_SEGMENTS: readonly string[] = [
  'admin',
  '__settings',
  'legal',
  'files',
  'login',
  'marketplace',
  'settings',
];

export interface InstalledAppRecordShape {
  id: string;
  name: string;
  origin: string;
  url: string;
  path: string;
  icon?: string;
  thirdParty: true;
  capabilities: AppCapability[];
  installedAt: string;
  updatedAt: string;
}

export interface NavigationOverlayShape<App = InstalledAppRecordShape> {
  version: 1;
  installedApps: App[];
  order: string[];
  hiddenPaths: string[];
  updatedAt: string;
}

export interface OverlayValidationContext {
  /** Fallback for a missing `installedAt` or `updatedAt` when sanitizing a stored layout. */
  now: string;
  /** `window.location.origin`. No app may share it. */
  shellOrigin?: string | null;
  /** Origins of static navigation items and the marketplace. No app may share them. */
  staticOrigins?: ReadonlySet<string>;
  /** First path segments the shell reserves beyond `RESERVED_PATH_SEGMENTS`. */
  reservedPaths?: Iterable<string>;
  /** Development builds only: accept `http://localhost`. Production builds never do. */
  allowLocalhost?: boolean;
}

export type OverlayRejection =
  | 'invalid_request'
  | 'origin_in_use'
  | 'path_reserved'
  | 'auth_not_allowed'
  | 'localhost_not_allowed'
  | 'too_many_apps'
  | 'too_large';

export type AppValidation =
  { ok: true; app: InstalledAppRecordShape } | { ok: false; error: OverlayRejection };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PATH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/;
const APP_KEYS = new Set([
  'id',
  'name',
  'origin',
  'url',
  'path',
  'icon',
  'thirdParty',
  'capabilities',
  'installedAt',
  'updatedAt',
]);
const DOCUMENT_KEYS = new Set(['version', 'installedApps', 'order', 'hiddenPaths', 'updatedAt']);
const KNOWN_CAPABILITIES = new Set<string>(APP_CAPABILITIES);
const STORED_CAPABILITIES = new Set<string>(THIRD_PARTY_CAPABILITIES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/** Loopback, private, link-local, and internal-only hosts. An installed app is never one of these. */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return true;
  if (isLoopbackHost(host) || host === '0.0.0.0') return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (host.includes(':')) {
    return (
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host.startsWith('::ffff:')
    );
  }
  return false;
}

/** True for `..`, `.`, backslashes, and encoded dots or slashes anywhere in a path. */
export function hasPathTraversal(value: string): boolean {
  if (value.includes('\\') || /%2e|%2f|%5c/i.test(value)) return true;
  return value.split('/').some((segment) => segment === '.' || segment === '..');
}

/** A path reduced to the segments the shell routes on, or null when it is empty or unsafe. */
export function normalizeInstalledAppPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || hasPathTraversal(raw)) return null;
  const path = raw.replace(/^\/+|\/+$/g, '');
  if (!path || path.length > OVERLAY_LIMITS.maxPathLength) return null;
  const segments = path.split('/');
  if (segments.some((segment) => segment === '')) return null;
  if (!PATH_PATTERN.test(path)) return null;
  return path;
}

/** Turn an arbitrary string (an app id, a suggested path) into a candidate path. */
export function slugifyPath(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/-+/g, '-');
}

export function reservedSegmentSet(extra?: Iterable<string>): Set<string> {
  const segments = new Set(RESERVED_PATH_SEGMENTS.map((segment) => segment.toLowerCase()));
  for (const entry of extra ?? []) {
    const first = entry.replace(/^\/+/, '').split('/')[0]?.toLowerCase();
    if (first) segments.add(first);
  }
  return segments;
}

/** True when the first path segment is reserved, or starts with `__` (shell-internal routes). */
export function isReservedAppPath(path: string, extra?: Iterable<string>): boolean {
  const first = path.replace(/^\/+/, '').split('/')[0]?.toLowerCase() ?? '';
  if (!first || first.startsWith('__')) return true;
  return reservedSegmentSet(extra).has(first);
}

function httpsOrigin(
  value: unknown,
  allowLocalhost: boolean,
): { url: string; origin: string; localhost: boolean } | OverlayRejection {
  if (typeof value !== 'string') return 'invalid_request';
  const url = value.trim();
  if (!url || url.length > OVERLAY_LIMITS.maxUrlLength) return 'invalid_request';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'invalid_request';
  }
  if (parsed.username || parsed.password) return 'invalid_request';
  const localhost = isLoopbackHost(parsed.hostname);
  if (parsed.protocol === 'https:') {
    if (isPrivateOrLoopbackHost(parsed.hostname)) {
      return allowLocalhost && localhost
        ? { url, origin: parsed.origin, localhost }
        : 'localhost_not_allowed';
    }
    return { url, origin: parsed.origin, localhost: false };
  }
  if (parsed.protocol === 'http:' && localhost) {
    return allowLocalhost
      ? { url, origin: parsed.origin, localhost: true }
      : 'localhost_not_allowed';
  }
  return 'invalid_request';
}

function timestamp(value: unknown, fallback: string): string | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value || value.length > OVERLAY_LIMITS.maxTimestampLength) {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}

/**
 * Validate one installed app record. This is the single check behind a runtime install,
 * a layout loaded from localStorage, and a layout loaded from identity.
 *
 * It rejects `auth`, any non-third-party record, the shell origin, a static origin, a reserved
 * or traversing path, and loopback or private hosts (unless `allowLocalhost`, development only).
 */
export function validateInstalledApp(
  value: unknown,
  context: OverlayValidationContext,
  options: { strict?: boolean } = {},
): AppValidation {
  if (!isRecord(value)) return { ok: false, error: 'invalid_request' };
  // The schema has `additionalProperties: false`. A stored layout may carry stray keys, which are
  // never copied. A strict check (what identity-service does on write) refuses them.
  if (options.strict && Object.keys(value).some((key) => !APP_KEYS.has(key))) {
    return { ok: false, error: 'invalid_request' };
  }
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!ID_PATTERN.test(id)) return { ok: false, error: 'invalid_request' };
  if (!name || name.length > OVERLAY_LIMITS.maxNameLength) {
    return { ok: false, error: 'invalid_request' };
  }
  if (value.thirdParty !== true) return { ok: false, error: 'invalid_request' };

  const target = httpsOrigin(value.url, context.allowLocalhost === true);
  if (typeof target === 'string') return { ok: false, error: target };
  if (typeof value.origin === 'string' && value.origin !== target.origin) {
    return { ok: false, error: 'invalid_request' };
  }
  if (context.shellOrigin && target.origin === context.shellOrigin) {
    return { ok: false, error: 'origin_in_use' };
  }
  if (context.staticOrigins?.has(target.origin)) return { ok: false, error: 'origin_in_use' };

  const path = normalizeInstalledAppPath(value.path);
  if (!path) return { ok: false, error: 'invalid_request' };
  if (isReservedAppPath(path, context.reservedPaths)) return { ok: false, error: 'path_reserved' };

  if (!Array.isArray(value.capabilities) || value.capabilities.length > APP_CAPABILITIES.length) {
    return { ok: false, error: 'invalid_request' };
  }
  const capabilities = new Set<string>();
  for (const entry of value.capabilities) {
    if (entry === 'auth') return { ok: false, error: 'auth_not_allowed' };
    if (typeof entry !== 'string' || !KNOWN_CAPABILITIES.has(entry)) {
      return { ok: false, error: 'invalid_request' };
    }
    if (!STORED_CAPABILITIES.has(entry) || capabilities.has(entry)) {
      return { ok: false, error: 'invalid_request' };
    }
    capabilities.add(entry);
  }
  capabilities.add('theme');
  capabilities.add('locale');

  let icon: string | undefined;
  if (value.icon !== undefined) {
    const iconTarget = httpsOrigin(value.icon, context.allowLocalhost === true);
    if (typeof iconTarget === 'string') return { ok: false, error: 'invalid_request' };
    icon = iconTarget.url;
  }
  const installedAt = timestamp(value.installedAt, context.now);
  const updatedAt = timestamp(value.updatedAt, context.now);
  if (!installedAt || !updatedAt) return { ok: false, error: 'invalid_request' };

  return {
    ok: true,
    app: {
      id,
      name,
      origin: target.origin,
      url: target.url,
      path,
      ...(icon ? { icon } : {}),
      thirdParty: true,
      capabilities: APP_CAPABILITIES.filter((capability) => capabilities.has(capability)),
      installedAt,
      updatedAt,
    },
  };
}

function boundedStrings(value: unknown, limit: number): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) return null;
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim() || entry.length > OVERLAY_LIMITS.maxPathLength) {
      return null;
    }
    seen.add(entry);
  }
  return seen.size === value.length ? [...seen] : null;
}

export type OverlayValidation =
  | { ok: true; overlay: NavigationOverlayShape; dropped: number }
  | { ok: false; error: OverlayRejection };

/**
 * Validate a whole overlay document.
 *
 * `strict` refuses the document on the first bad app, which is what identity-service does.
 * Otherwise a bad app is dropped and the rest is kept, which is how a stored layout is read.
 * Both refuse a document over 100 apps or over 64 KB.
 */
export function validateNavigationOverlay(
  raw: unknown,
  context: OverlayValidationContext,
  options: { strict?: boolean } = {},
): OverlayValidation {
  const payload = isRecord(raw) && isRecord(raw.overlay) ? raw.overlay : raw;
  if (!isRecord(payload) || payload.version !== NAVIGATION_OVERLAY_VERSION) {
    return { ok: false, error: 'invalid_request' };
  }
  if (options.strict && Object.keys(payload).some((key) => !DOCUMENT_KEYS.has(key))) {
    return { ok: false, error: 'invalid_request' };
  }
  try {
    if (JSON.stringify(payload).length > OVERLAY_LIMITS.maxBytes) {
      return { ok: false, error: 'too_large' };
    }
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
  const apps = payload.installedApps ?? [];
  if (!Array.isArray(apps)) return { ok: false, error: 'invalid_request' };
  if (apps.length > OVERLAY_LIMITS.maxApps) return { ok: false, error: 'too_many_apps' };

  const order = boundedStrings(payload.order, OVERLAY_LIMITS.maxOrder);
  const hiddenPaths = boundedStrings(payload.hiddenPaths, OVERLAY_LIMITS.maxHiddenPaths);
  if (options.strict && (!order || !hiddenPaths)) return { ok: false, error: 'invalid_request' };

  const installedApps: InstalledAppRecordShape[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  let dropped = 0;
  for (const entry of apps) {
    const result = validateInstalledApp(entry, context, options);
    const duplicate = result.ok && (ids.has(result.app.id) || paths.has(result.app.path));
    if (!result.ok || duplicate) {
      if (options.strict) return { ok: false, error: result.ok ? 'invalid_request' : result.error };
      dropped += 1;
      continue;
    }
    ids.add(result.app.id);
    paths.add(result.app.path);
    installedApps.push(result.app);
  }

  const updatedAt = timestamp(payload.updatedAt, context.now) ?? context.now;
  return {
    ok: true,
    dropped,
    overlay: {
      version: NAVIGATION_OVERLAY_VERSION,
      installedApps,
      order: order ?? [],
      hiddenPaths: hiddenPaths ?? [],
      updatedAt,
    },
  };
}
