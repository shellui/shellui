import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCodeChallenge } from './pkce';
import {
  WEB_PKCE_FLOW_PARAM,
  isMagicLinkFlowId,
  isWebPkceErrorCode,
  prepareWebPkce,
  takeWebPkceVerifier,
} from './webPkce';

function memoryStorage(seed: [string, string][] = []): Storage {
  const map = new Map<string, string>(seed);
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

function storedVerifier(store: Storage): string {
  const keys = Array.from({ length: store.length }, (_, i) => store.key(i) as string);
  const key = keys.find((k) => k.startsWith('shellui.auth.pkce.'));
  expect(key).toBeTruthy();
  return (JSON.parse(store.getItem(key as string) as string) as { verifier: string }).verifier;
}

describe('webPkce', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('adds only the flow id to redirect_to and keeps the verifier in sessionStorage', async () => {
    const prepared = await prepareWebPkce(
      'https://app.test/login/callback?provider=google',
      'oauth',
    );
    const url = new URL(prepared.redirectTo);
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get(WEB_PKCE_FLOW_PARAM)).toBe(prepared.flowId);
    const verifier = storedVerifier(sessionStorage);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(prepared.redirectTo).not.toContain(verifier);
    expect(prepared.challenge).toBe(await generateCodeChallenge(verifier));
    expect(localStorage.length).toBe(0);
  });

  it('keeps concurrent flows apart and is single use', async () => {
    const a = await prepareWebPkce('https://app.test/cb', 'oauth');
    const b = await prepareWebPkce('https://app.test/cb', 'oauth');
    expect(a.flowId).not.toBe(b.flowId);
    const va = takeWebPkceVerifier(a.flowId);
    const vb = takeWebPkceVerifier(b.flowId);
    expect(va).toBeTruthy();
    expect(vb).toBeTruthy();
    expect(va).not.toBe(vb);
    expect(takeWebPkceVerifier(a.flowId)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('stores a magic link verifier in localStorage only, readable from another tab', async () => {
    const prepared = await prepareWebPkce('https://app.test/cb', 'magic_link');
    expect(isMagicLinkFlowId(prepared.flowId)).toBe(true);
    expect(sessionStorage.length).toBe(0);
    sessionStorage.clear();
    expect(takeWebPkceVerifier(prepared.flowId)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(localStorage.length).toBe(0);
    expect(takeWebPkceVerifier(prepared.flowId)).toBeNull();
  });

  it('expires a magic link verifier after 15 minutes', async () => {
    vi.useFakeTimers();
    const prepared = await prepareWebPkce('https://app.test/cb', 'magic_link');
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(takeWebPkceVerifier(prepared.flowId)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('rejects malformed flow ids and knows the PKCE error codes', () => {
    expect(takeWebPkceVerifier('../x')).toBeNull();
    expect(takeWebPkceVerifier(null)).toBeNull();
    expect(isMagicLinkFlowId(`o${'0'.repeat(32)}`)).toBe(false);
    expect(isWebPkceErrorCode('pkce_verification_failed')).toBe(true);
    expect(isWebPkceErrorCode('pkce_required')).toBe(true);
    expect(isWebPkceErrorCode('other')).toBe(false);
  });
});
