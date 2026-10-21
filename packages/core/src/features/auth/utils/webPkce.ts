import { createPkcePair } from './pkce';

/**
 * S256 PKCE for web sign-in (identity-service 0.9.0 and later).
 *
 * Each flow gets a random id. Only the id goes on `redirect_to` as
 * `shellui_pkce_flow`, so the callback can find its own verifier and two
 * sign-ins started in parallel do not overwrite each other. The verifier is
 * never put in a URL.
 *
 * OAuth and SAML keep the verifier in `sessionStorage`: the callback lands in
 * the tab that started the flow. A magic link opens from the email, often in a
 * new tab with an empty `sessionStorage`, so that flow alone keeps the
 * verifier in `localStorage`, keyed by the flow id, for 15 minutes. It is
 * single use and removed on read, so the link only works in the browser that
 * requested it.
 */

export const WEB_PKCE_FLOW_PARAM = 'shellui_pkce_flow';
const SESSION_PREFIX = 'shellui.auth.pkce.';
const MAGIC_LINK_PREFIX = 'shellui.auth.pkce.magic.';
/** A magic link only works for 15 minutes in the browser that requested it. */
const MAGIC_LINK_MAX_AGE_MS = 15 * 60 * 1000;
const OAUTH_MAX_AGE_MS = 30 * 60 * 1000;
/** Magic link flow ids start with `m`, OAuth and SAML ids with `o`. */
const MAGIC_LINK_FLOW_MARK = 'm';
const FLOW_ID_PATTERN = /^[mo][0-9a-f]{32}$/;

export type WebPkceFlowKind = 'oauth' | 'magic_link';

interface StoredVerifier {
  verifier: string;
  createdAt: number;
  /** Exact `redirect_to` sent at sign-in start. The exchange must send it back unchanged. */
  redirectTo?: string;
}

export interface TakenWebPkceFlow {
  verifier: string;
  /** Exact `redirect_to` from sign-in start, or null when an older entry has none. */
  redirectTo: string | null;
}

export interface PreparedWebPkce {
  flowId: string;
  challenge: string;
  /** `redirectTo` with the flow id added. */
  redirectTo: string;
}

function store(kind: 'session' | 'local'): Storage | null {
  try {
    const s = kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function randomFlowId(kind: WebPkceFlowKind): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const mark = kind === 'magic_link' ? MAGIC_LINK_FLOW_MARK : 'o';
  return mark + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function write(s: Storage | null, key: string, value: StoredVerifier): boolean {
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readAndRemove(s: Storage | null, key: string, maxAgeMs: number): TakenWebPkceFlow | null {
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    s.removeItem(key);
    const parsed = JSON.parse(raw) as StoredVerifier;
    if (typeof parsed?.verifier !== 'string' || typeof parsed.createdAt !== 'number') return null;
    if (Date.now() - parsed.createdAt > maxAgeMs) return null;
    const redirectTo = typeof parsed.redirectTo === 'string' ? parsed.redirectTo : null;
    return { verifier: parsed.verifier, redirectTo };
  } catch {
    return null;
  }
}

/** Drop expired magic link verifiers left by flows that were never finished. */
function pruneMagicLinkVerifiers(): void {
  const s = store('local');
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const key = s.key(i);
      if (!key?.startsWith(MAGIC_LINK_PREFIX)) continue;
      try {
        const parsed = JSON.parse(s.getItem(key) ?? '') as StoredVerifier;
        if (Date.now() - parsed.createdAt <= MAGIC_LINK_MAX_AGE_MS) continue;
      } catch {
        // unreadable: remove
      }
      s.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export async function prepareWebPkce(
  redirectTo: string,
  kind: WebPkceFlowKind,
): Promise<PreparedWebPkce> {
  const { verifier, challenge } = await createPkcePair();
  const flowId = randomFlowId(kind);
  const url = new URL(redirectTo);
  url.searchParams.set(WEB_PKCE_FLOW_PARAM, flowId);
  const finalRedirectTo = url.toString();
  // Static hosts such as GitHub Pages can redirect `/login/callback` to
  // `/login/callback/`, so the callback URL is not always the one sent at start.
  const entry: StoredVerifier = { verifier, createdAt: Date.now(), redirectTo: finalRedirectTo };
  if (kind === 'magic_link') {
    pruneMagicLinkVerifiers();
    write(store('local'), MAGIC_LINK_PREFIX + flowId, entry);
  } else {
    write(store('session'), SESSION_PREFIX + flowId, entry);
  }
  return { flowId, challenge, redirectTo: finalRedirectTo };
}

/** Read the verifier for a callback and remove every stored copy. */
export function takeWebPkceVerifier(flowId: string | null | undefined): string | null {
  return takeWebPkceFlow(flowId)?.verifier ?? null;
}

/** Read the verifier and the exact start `redirect_to` for a callback, single use. */
export function takeWebPkceFlow(flowId: string | null | undefined): TakenWebPkceFlow | null {
  const id = flowId?.trim();
  if (!id || !FLOW_ID_PATTERN.test(id)) return null;
  if (isMagicLinkFlowId(id)) {
    return readAndRemove(store('local'), MAGIC_LINK_PREFIX + id, MAGIC_LINK_MAX_AGE_MS);
  }
  return readAndRemove(store('session'), SESSION_PREFIX + id, OAUTH_MAX_AGE_MS);
}

export function isMagicLinkFlowId(flowId: string | null | undefined): boolean {
  return !!flowId && flowId.startsWith(MAGIC_LINK_FLOW_MARK) && FLOW_ID_PATTERN.test(flowId);
}

/** Remove a flow's verifier, e.g. when starting it failed. */
export function clearWebPkce(flowId: string): void {
  takeWebPkceVerifier(flowId);
}

export const WEB_PKCE_ERROR_CODES = [
  'pkce_required',
  'invalid_code_challenge',
  'invalid_code_challenge_method',
  'invalid_code_verifier',
  'pkce_verification_failed',
] as const;

export function isWebPkceErrorCode(code: string | null | undefined): boolean {
  return !!code && (WEB_PKCE_ERROR_CODES as readonly string[]).includes(code);
}
