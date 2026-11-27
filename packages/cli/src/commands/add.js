import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import {
  discoverConfigMode,
  resolveConfigLocation,
  splitConfigFileName,
} from '../utils/config-paths.js';

export const DEFAULT_MARKETPLACE_API_URL = 'https://api.marketplace.shellui.com';

/**
 * Hosts whose apps count as official. This is the same rule as the in-code allowlist in
 * marketplace-service (`apps/catalog/official.py`): https on `shellui.com` or a subdomain.
 * The catalog's own `official` flag is never read, so a poisoned row cannot raise trust.
 */
export const OFFICIAL_HOST = 'shellui.com';

/**
 * First path segments the shell routes itself. Keep in step with `RESERVED_PATH_SEGMENTS`
 * in `@shellui/sdk` (a test in this package compares the two).
 */
export const RESERVED_NAV_SEGMENTS = [
  'admin',
  '__settings',
  'legal',
  'files',
  'login',
  'marketplace',
  'settings',
];

/** @param {string} url */
export function isOfficialAppUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return host === OFFICIAL_HOST || host.endsWith(`.${OFFICIAL_HOST}`);
  } catch {
    return false;
  }
}

/**
 * Catalog URL for one app. `apiUrl` is the marketplace API origin, or a base
 * that already ends in `/api/apps`.
 * @param {string | undefined} apiUrl
 * @param {string} appId
 */
export function marketplaceAppEndpoint(apiUrl, appId) {
  const base = String(apiUrl || DEFAULT_MARKETPLACE_API_URL)
    .trim()
    .replace(/\/+$/, '');
  const slug = encodeURIComponent(appId);
  if (/\/api\/apps$/i.test(base)) return `${base}/${slug}`;
  return `${base}/api/apps/${slug}`;
}

/**
 * @param {unknown} navigation
 * @returns {string[]}
 */
export function collectNavigationPaths(navigation) {
  if (!Array.isArray(navigation)) return [];
  const paths = [];
  for (const entry of navigation) {
    if (!entry || typeof entry !== 'object') continue;
    if (Array.isArray(entry.items)) {
      for (const item of entry.items) {
        if (item && typeof item.path === 'string') paths.push(normalizeNavPath(item.path));
      }
    } else if (typeof entry.path === 'string') {
      paths.push(normalizeNavPath(entry.path));
    }
  }
  return paths.filter(Boolean);
}

function normalizeNavPath(value) {
  return String(value)
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function httpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Build a navigation item from Shellui Marketplace catalog JSON.
 * "Official" comes from the app URL and the allowlist above, not from the catalog flag.
 * Other apps cannot set `safeForAuthToken` unless `allowAuth` is true.
 * @param {unknown} metadata
 * @param {{ allowAuth?: boolean, appId?: string }} [options]
 */
export function navigationItemFromCatalog(metadata, options = {}) {
  const record =
    metadata && typeof metadata === 'object' && metadata.app && typeof metadata.app === 'object'
      ? metadata.app
      : metadata;
  if (!record || typeof record !== 'object') {
    return { ok: false, error: 'Shellui Marketplace returned an empty app record.' };
  }
  const name =
    (typeof record.name === 'string' && record.name.trim()) ||
    (typeof record.label === 'string' && record.label.trim()) ||
    (typeof record.title === 'string' && record.title.trim()) ||
    '';
  const url = httpsUrl(record.url);
  if (!name || !url) {
    return {
      ok: false,
      error: 'The catalog record needs a name and an HTTPS url.',
    };
  }
  const pathSource =
    (typeof record.path === 'string' && record.path.trim()) ||
    (typeof record.slug === 'string' && record.slug.trim()) ||
    (typeof options.appId === 'string' && options.appId.trim()) ||
    '';
  const itemPath = normalizeNavPath(pathSource).replace(/[^a-zA-Z0-9/_-]+/g, '-');
  if (
    !itemPath ||
    itemPath.includes('..') ||
    !/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,120}$/.test(itemPath)
  ) {
    return { ok: false, error: 'The catalog path is not a valid navigation path.' };
  }
  const firstSegment = itemPath.split('/')[0].toLowerCase();
  if (RESERVED_NAV_SEGMENTS.includes(firstSegment) || firstSegment.startsWith('__')) {
    return { ok: false, error: `"${firstSegment}" is a core shell path. Pick another path.` };
  }
  const official = isOfficialAppUrl(url);
  const wantsAuth = record.safeForAuthToken === true;
  if (wantsAuth && !official && options.allowAuth !== true) {
    return {
      ok: false,
      error:
        'This app is not served from an official Shellui origin and asks for safeForAuthToken. Re-run with --allow-auth if you intend to share the session token.',
    };
  }
  const icon = httpsUrl(record.icon);
  const item = {
    label: name,
    path: itemPath,
    url,
    ...(icon ? { icon } : {}),
    ...(wantsAuth && (official || options.allowAuth === true) ? { safeForAuthToken: true } : {}),
  };
  return {
    ok: true,
    item,
    summary: {
      name,
      path: itemPath,
      url,
      official,
      safeForAuthToken: item.safeForAuthToken === true,
    },
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * @param {string} appId
 * @param {{
 *   apiUrl?: string,
 *   config?: string,
 *   root?: string,
 *   allowAuth?: boolean,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 */
export async function addAppCommand(appId, options = {}) {
  const id = typeof appId === 'string' ? appId.trim() : '';
  if (!id) {
    console.error(pc.red('Usage: shellui add <app-id>'));
    process.exitCode = 1;
    return;
  }

  const endpoint = marketplaceAppEndpoint(options.apiUrl, id);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let response;
  try {
    response = await fetchImpl(endpoint, { headers: { Accept: 'application/json' } });
  } catch {
    console.error(pc.red(`Could not reach Shellui Marketplace at ${endpoint}.`));
    process.exitCode = 1;
    return;
  }
  if (!response?.ok) {
    console.error(
      pc.red(`Shellui Marketplace returned HTTP ${response?.status ?? 0} for "${id}".`),
    );
    process.exitCode = 1;
    return;
  }
  const metadata = await response.json().catch(() => null);
  const built = navigationItemFromCatalog(metadata, {
    allowAuth: options.allowAuth === true,
    appId: id,
  });
  if (!built.ok) {
    console.error(pc.red(built.error));
    process.exitCode = 1;
    return;
  }

  const location = resolveConfigLocation(options.root ?? '.', options.config);
  let mode;
  try {
    mode = discoverConfigMode(location.configDir);
  } catch (error) {
    console.error(pc.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
    return;
  }
  if (mode.mode === 'none' || mode.mode === 'ts') {
    console.error(
      pc.red(
        'shellui add writes shellui.config.json (or a split navigation file). Run shellui config migrate first when the project only has shellui.config.ts.',
      ),
    );
    process.exitCode = 1;
    return;
  }

  if (mode.mode === 'main') {
    const config = readJson(mode.mainPath);
    const navigation = Array.isArray(config.navigation) ? config.navigation : [];
    if (collectNavigationPaths(navigation).includes(built.item.path)) {
      console.error(pc.red(`Navigation already includes path "${built.item.path}".`));
      process.exitCode = 1;
      return;
    }
    config.navigation = [...navigation, built.item];
    writeJson(mode.mainPath, config);
  } else {
    const navFile = mode.splitFiles?.find((file) => file.name === 'navigation') ?? null;
    const filePath =
      navFile?.path ?? path.join(location.configDir, splitConfigFileName('navigation'));
    const existing = navFile && fs.existsSync(filePath) ? readJson(filePath) : { navigation: [] };
    const navigation = Array.isArray(existing.navigation) ? existing.navigation : [];
    if (collectNavigationPaths(navigation).includes(built.item.path)) {
      console.error(pc.red(`Navigation already includes path "${built.item.path}".`));
      process.exitCode = 1;
      return;
    }
    existing.navigation = [...navigation, built.item];
    writeJson(filePath, existing);
  }

  const { summary } = built;
  console.log(pc.green(`Added ${summary.name} to navigation.`));
  console.log(`  path: ${summary.path}`);
  console.log(`  url: ${summary.url}`);
  console.log(`  official: ${summary.official ? 'yes' : 'no'}`);
  console.log(`  safeForAuthToken: ${summary.safeForAuthToken ? 'yes' : 'no'}`);
}
