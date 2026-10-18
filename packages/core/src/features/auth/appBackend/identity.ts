import type { AppBackendConfig, NavigationItem, ShellUIConfig } from '../../config/types';
import { isFrameForAppUrl } from '../../layouts/utils';
import { flattenNavigationItems } from '../../settings/utils/flattenNavigationItems';

export type ResolvedAppBackend = {
  key: string;
  type: 'shellui' | 'supabase';
  url: string;
  companyId?: string | number;
  publishableKey?: string;
  provider: string | null;
};

export type FrameAppBackend =
  | { kind: 'shell' }
  | { kind: 'foreign'; identity: ResolvedAppBackend }
  | { kind: 'withhold' };

/** http(s) base URL without trailing slash, query, or hash. Host is lowercased. */
export function normalizeBackendUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path === '/' ? '' : path}`;
  } catch {
    return null;
  }
}

function companyKey(companyId: string | number | undefined): string {
  if (companyId === undefined || companyId === null) return '';
  const text = `${companyId}`.trim();
  return text;
}

export function appBackendKey(parts: {
  type: string;
  url: string;
  companyId?: string | number;
}): string {
  return `${parts.type}\n${parts.url}\n${companyKey(parts.companyId)}`;
}

function shellProvider(config?: ShellUIConfig): string | null {
  const providers = config?.backend?.login?.oauthProviders;
  const first = providers?.find((provider) => typeof provider === 'string' && provider.trim());
  return first ? first.trim().toLowerCase() : null;
}

function resolveType(
  override: AppBackendConfig,
  config?: ShellUIConfig,
): 'shellui' | 'supabase' | null {
  const type = override.type ?? config?.backend?.type ?? 'shellui';
  if (type === 'shellui' || type === 'supabase') return type;
  return null;
}

/**
 * Same server as the shell when type and URL match and the app does not name
 * a different tenant. An omitted `companyId` keeps the shell session.
 */
export function isDistinctFromShell(identity: ResolvedAppBackend, config?: ShellUIConfig): boolean {
  const shell = config?.backend;
  const shellUrl = normalizeBackendUrl(shell?.url);
  if (!shell?.type || !shellUrl) return true;
  if (identity.type !== shell.type || identity.url !== shellUrl) return true;
  if (companyKey(identity.companyId) === '') return false;
  return `${identity.companyId}` !== `${shell.companyId ?? ''}`;
}

export function resolveAppBackendConfig(
  override: AppBackendConfig | undefined,
  config?: ShellUIConfig,
): ResolvedAppBackend | null {
  if (!override) return null;
  const type = resolveType(override, config);
  const url = normalizeBackendUrl(override.url);
  if (!type || !url) return null;
  const provider = override.provider?.trim().toLowerCase() || shellProvider(config);
  const companyId = companyKey(override.companyId) === '' ? undefined : override.companyId;
  return {
    type,
    url,
    ...(companyId !== undefined ? { companyId } : {}),
    ...(override.publishableKey?.trim() ? { publishableKey: override.publishableKey.trim() } : {}),
    provider,
    key: appBackendKey({ type, url, companyId }),
  };
}

function embeddedItems(config?: ShellUIConfig): NavigationItem[] {
  const top = flattenNavigationItems(config?.navigation ?? []);
  const admin = config?.administration?.navigation ?? [];
  return [...top, ...admin].filter(
    (item) => item.openIn !== 'external' && Boolean(item.url?.trim()),
  );
}

/** Longer pathname wins so a site-root item does not override a nested app. */
export function appUrlSpecificity(appUrl: string): number {
  try {
    const url = new URL(appUrl, 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '');
    const hash = (url.hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
    return path.length * 1000 + hash.length;
  } catch {
    return 0;
  }
}

function hasDistinctBackend(item: NavigationItem, config?: ShellUIConfig): boolean {
  if (!item.backend) return false;
  const identity = resolveAppBackendConfig(item.backend, config);
  if (!identity) return true;
  return isDistinctFromShell(identity, config);
}

function matchingItems(frameSrc: string, config?: ShellUIConfig): NavigationItem[] {
  const matches = embeddedItems(config).filter((item) => isFrameMatch(frameSrc, item.url));
  matches.sort((a, b) => {
    const score = appUrlSpecificity(b.url) - appUrlSpecificity(a.url);
    if (score !== 0) return score;
    const aForeign = hasDistinctBackend(a, config) ? 1 : 0;
    const bForeign = hasDistinctBackend(b, config) ? 1 : 0;
    return bForeign - aForeign;
  });
  return matches;
}

/** Most specific embedded item for this frame, if any. */
export function resolveFrameNavigationItem(
  frameSrc: string,
  config?: ShellUIConfig,
): NavigationItem | null {
  return matchingItems(frameSrc, config)[0] ?? null;
}

/**
 * Which identity server a frame should use.
 * `shell` keeps today's single backend. `withhold` means the item named a backend
 * we cannot use, so the shell token must not be sent. `foreign` is a different server.
 */
export function resolveFrameAppBackend(frameSrc: string, config?: ShellUIConfig): FrameAppBackend {
  const winner = matchingItems(frameSrc, config)[0];
  if (!winner?.backend) return { kind: 'shell' };
  const identity = resolveAppBackendConfig(winner.backend, config);
  if (!identity) return { kind: 'withhold' };
  if (!isDistinctFromShell(identity, config)) return { kind: 'shell' };
  return { kind: 'foreign', identity };
}

function isFrameMatch(frameSrc: string, appUrl: string): boolean {
  return isFrameForAppUrl(frameSrc, appUrl);
}

/** Distinct foreign identity servers referenced by embedded apps. */
export function listDistinctAppBackends(config?: ShellUIConfig): ResolvedAppBackend[] {
  const seen = new Set<string>();
  const list: ResolvedAppBackend[] = [];
  for (const item of embeddedItems(config)) {
    if (!item.backend) continue;
    const identity = resolveAppBackendConfig(item.backend, config);
    if (!identity || !isDistinctFromShell(identity, config)) continue;
    if (seen.has(identity.key)) continue;
    seen.add(identity.key);
    list.push(identity);
  }
  return list;
}
