import {
  hasPathTraversal,
  isReservedAppPath,
  normalizeInstalledAppPath,
  sanitizeCapabilityList,
  slugifyPath,
  validateInstalledApp,
  type AppCapability,
  type OverlayRejection,
  type OverlayValidationContext,
} from '@shellui/sdk';
import { safeRemoteIconUrl } from './icons';
import type { InstalledAppRecord } from './overlay';

export interface MarketplaceInstallRequest {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  path?: unknown;
  icon?: unknown;
  /** Ignored. Every runtime install is third-party, whatever the catalog says. */
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
  /** True when this id is already installed. The person confirms the update again. */
  update: boolean;
}

export type InstallError = OverlayRejection | 'third_party_disabled';

export type InstallPreparation =
  | { ok: false; error: InstallError }
  | {
      ok: true;
      /** Always true. A runtime install is never silent. */
      needsConfirmation: true;
      record: InstalledAppRecord;
      summary: InstallSummary;
    };

/** Zero-width, bidirectional, and control characters that can disguise a name. */
const INVISIBLE =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const SHELL_LABELS = new Set([
  'settings',
  'admin',
  'administration',
  'security',
  'account',
  'sign in',
  'log in',
  'login',
]);

/** A display name with no hidden characters that does not pass itself off as the shell. */
export function cleanAppName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFKC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 80) return null;
  const lower = name.toLowerCase();
  if (lower.includes('shellui') || SHELL_LABELS.has(lower)) return null;
  return name;
}

function allocatePath(desired: string, taken: ReadonlySet<string>): string {
  if (!taken.has(desired)) return desired;
  let n = 2;
  while (taken.has(`${desired}-${n}`)) n += 1;
  return `${desired}-${n}`;
}

/**
 * Check one install request and build the record to store.
 *
 * Every runtime install is treated as third-party and needs a confirmation, including
 * a reinstall of an id that is already present. The catalog's `thirdParty`, `auth`,
 * `safeForAuthToken`, and child-frame fields are ignored. The record then goes through
 * the same validator as a layout read from storage, so the two cannot disagree.
 */
export function prepareInstall(
  request: MarketplaceInstallRequest,
  options: {
    allowThirdParty: boolean;
    validation: OverlayValidationContext;
    takenPaths: ReadonlySet<string>;
    existing?: InstalledAppRecord | null;
  },
): InstallPreparation {
  const id = typeof request.id === 'string' ? request.id.trim() : '';
  const name = cleanAppName(request.name);
  const url = typeof request.url === 'string' ? request.url.trim() : '';
  if (!id || !name || !url) return { ok: false, error: 'invalid_request' };
  if (!options.allowThirdParty) return { ok: false, error: 'third_party_disabled' };

  const existing = options.existing ?? null;
  const rawPath = typeof request.path === 'string' && request.path.trim() ? request.path : id;
  if (hasPathTraversal(rawPath)) return { ok: false, error: 'invalid_request' };
  const desired = existing?.path ?? normalizeInstalledAppPath(slugifyPath(rawPath));
  if (!desired) return { ok: false, error: 'invalid_request' };
  if (isReservedAppPath(desired, options.validation.reservedPaths)) {
    return { ok: false, error: 'path_reserved' };
  }
  const taken = new Set(options.takenPaths);
  if (existing) taken.delete(existing.path);
  const path = existing ? existing.path : allocatePath(desired, taken);

  const requested = Array.isArray(request.capabilities) ? request.capabilities : [];
  const capabilities = sanitizeCapabilityList(
    ['theme', 'locale', ...requested.filter((entry) => entry !== 'auth')],
    true,
  );
  const deniedPrivileged =
    requested.includes('auth') ||
    requested.includes('childFrames') ||
    requested.includes('safeForAuthToken') ||
    request.safeForAuthToken === true ||
    (request.childFrames !== undefined && request.childFrames !== null);

  const now = options.validation.now;
  const icon = safeRemoteIconUrl(request.icon);
  const checked = validateInstalledApp(
    {
      id,
      name,
      origin: (() => {
        try {
          return new URL(url).origin;
        } catch {
          return undefined;
        }
      })(),
      url,
      path,
      ...(icon ? { icon } : {}),
      thirdParty: true,
      capabilities,
      installedAt: existing?.installedAt ?? now,
      updatedAt: now,
    },
    options.validation,
  );
  if (!checked.ok) return { ok: false, error: checked.error };

  return {
    ok: true,
    needsConfirmation: true,
    record: checked.app,
    summary: {
      name,
      origin: checked.app.origin,
      capabilities: checked.app.capabilities,
      deniedPrivileged,
      update: existing !== null,
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
