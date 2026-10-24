import type { ShellUIConfig } from '../../config/types';
import {
  resolveAppBackendConfig,
  resolveFrameNavigationItem,
  type ResolvedAppBackend,
} from './identity';

/** A child app hosted by an embedded app, as accepted by the shell. */
export type ChildFrameEntry = {
  hostUuid: string;
  frameId: string;
  url: string;
  identity: ResolvedAppBackend | null;
  /** Host-supplied service URLs that passed `childFrames.serviceOrigins`. Others are `null`. */
  services: ChildFrameServices;
  /** Service keys dropped because the URL was invalid or its origin not allowed. */
  rejectedServices: ChildFrameServiceKey[];
};

export type ChildFrameServiceKey = 'email' | 'storage' | 'hosting';
export type ChildFrameServices = Record<ChildFrameServiceKey, string | null>;
const SERVICE_KEYS: readonly ChildFrameServiceKey[] = ['email', 'storage', 'hosting'];

export type ChildFrameRegistration =
  | { ok: true; entry: ChildFrameEntry }
  | { ok: false; reason: string };

const entries = new Map<string, ChildFrameEntry>();

function entryKey(hostUuid: string, frameId: string): string {
  return `${hostUuid}\n${frameId}`;
}

function exactOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function originList(values: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(values)) return out;
  for (const value of values) {
    // Only exact origins count. A path, wildcard or `*` never matches.
    const origin = exactOrigin(value);
    if (origin && origin === `${value}`.trim().replace(/\/$/, '')) out.add(origin);
  }
  return out;
}

/**
 * Keep each host-supplied service URL only when it is http(s) and its origin is
 * exactly in `allowed`. Missing or rejected values become `null`: the child never
 * falls back to the shell's own services or to a built-in default.
 */
export function resolveChildFrameServices(
  input: unknown,
  allowedOrigins: unknown,
): { services: ChildFrameServices; rejected: ChildFrameServiceKey[] } {
  const allowed = originList(allowedOrigins);
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const services: ChildFrameServices = { email: null, storage: null, hosting: null };
  const rejected: ChildFrameServiceKey[] = [];
  for (const key of SERVICE_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    const origin = exactOrigin(value);
    if (origin && allowed.has(origin)) {
      services[key] = `${value}`.trim().replace(/\/+$/, '');
    } else {
      rejected.push(key);
    }
  }
  return { services, rejected };
}

/**
 * Check a `SHELLUI_CHILD_FRAME_REGISTER` message. `from` must be exactly one hop:
 * a child app cannot register frames by sending the message through its host.
 */
export function validateChildFrameRegistration(input: {
  from: readonly string[] | undefined;
  hostSrc: string | null | undefined;
  payload: unknown;
  config?: ShellUIConfig;
}): ChildFrameRegistration {
  const from = (input.from ?? []).filter(Boolean);
  if (from.length !== 1) return { ok: false, reason: 'not sent by a direct app frame' };
  if (!input.hostSrc) return { ok: false, reason: 'unknown host frame' };
  const payload = input.payload as
    | { frameId?: unknown; url?: unknown; backend?: unknown; services?: unknown }
    | null
    | undefined;
  const frameId = typeof payload?.frameId === 'string' ? payload.frameId.trim() : '';
  if (!frameId) return { ok: false, reason: 'missing frameId' };
  const childOrigin = exactOrigin(payload?.url);
  if (!childOrigin) return { ok: false, reason: 'child URL is not http(s)' };

  const item = resolveFrameNavigationItem(input.hostSrc, input.config);
  const rules = item?.childFrames;
  if (!rules) return { ok: false, reason: 'host app may not embed apps' };
  if (!originList(rules.origins).has(childOrigin)) {
    return { ok: false, reason: 'child origin is not allowed' };
  }

  let identity: ResolvedAppBackend | null = null;
  const backend = payload?.backend as
    | { url?: unknown; companyId?: unknown; type?: unknown; provider?: unknown }
    | null
    | undefined;
  if (backend) {
    const backendOrigin = exactOrigin(backend.url);
    if (!backendOrigin || !originList(rules.backendOrigins).has(backendOrigin)) {
      return { ok: false, reason: 'child identity server is not allowed' };
    }
    const companyId =
      typeof backend.companyId === 'string' || typeof backend.companyId === 'number'
        ? backend.companyId
        : undefined;
    const type =
      backend.type === 'shellui' || backend.type === 'supabase' ? backend.type : undefined;
    identity = resolveAppBackendConfig(
      {
        url: backend.url as string,
        ...(companyId !== undefined ? { companyId } : {}),
        ...(type ? { type } : {}),
        ...(typeof backend.provider === 'string' ? { provider: backend.provider } : {}),
      },
      input.config,
    );
    if (!identity) return { ok: false, reason: 'child identity server is invalid' };
  }

  const { services, rejected } = resolveChildFrameServices(payload?.services, rules.serviceOrigins);

  return {
    ok: true,
    entry: {
      hostUuid: from[0],
      frameId,
      url: payload?.url as string,
      identity,
      services,
      rejectedServices: rejected,
    },
  };
}

export function addChildFrame(entry: ChildFrameEntry): void {
  entries.set(entryKey(entry.hostUuid, entry.frameId), entry);
}

export function removeChildFrame(hostUuid: string, frameId: string): void {
  entries.delete(entryKey(hostUuid, frameId));
}

/** The registered child for a `from` path such as `[host, child, ...]`. */
export function findChildFrame(path: readonly string[]): ChildFrameEntry | null {
  if (path.length < 2) return null;
  return entries.get(entryKey(path[0], path[1])) ?? null;
}

/** Children whose host frame is still registered. Others are dropped. */
export function listChildFrames(isHostKnown: (uuid: string) => boolean): ChildFrameEntry[] {
  const out: ChildFrameEntry[] = [];
  for (const [key, entry] of entries) {
    if (!isHostKnown(entry.hostUuid)) entries.delete(key);
    else out.push(entry);
  }
  return out;
}

export function clearChildFrames(): void {
  entries.clear();
}
