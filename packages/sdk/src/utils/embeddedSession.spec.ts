import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '../types.js';
import {
  bindVisibleResume,
  createSessionRequestGate,
  deliverSessionHandoff,
  isAccessTokenExpired,
  reconcileEmbeddedAccessToken,
  runNowAndSoon,
  SESSION_HANDOFF_RETRY_MS,
  type ResumeTarget,
} from './embeddedSession.js';

function jwtWithExp(exp: number): string {
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.sig`;
}

function fakeTarget(): ResumeTarget & {
  emit: (type: string) => void;
  visibilityState?: DocumentVisibilityState;
} {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState: 'visible',
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type) {
      listeners.get(type)?.forEach((listener) => listener());
    },
  };
}

describe('reconcileEmbeddedAccessToken', () => {
  const now = 1_700_000_000;

  it('keeps the previous access token and asks the shell when a payload drops it', () => {
    const previous = { accessToken: 'still-good', user: { id: 'u' } } as Settings;
    const incoming = {
      accessToken: null,
      user: { id: 'u' },
      appearance: { mode: 'dark' },
    } as Settings;

    const result = reconcileEmbeddedAccessToken(previous, incoming, now);

    expect(result.settings.accessToken).toBe('still-good');
    expect(result.requestFreshToken).toBe(true);
  });

  it('asks for a fresh token when the JWT is inside the refresh leeway, and does not clear it', () => {
    const token = jwtWithExp(now + 30);
    const incoming = { accessToken: token, user: { id: 'u' } } as Settings;

    const result = reconcileEmbeddedAccessToken(null, incoming, now);

    expect(result.settings.accessToken).toBe(token);
    expect(result.requestFreshToken).toBe(true);
    expect(isAccessTokenExpired(token, now)).toBe(true);
  });

  it('clears the token on logout instead of asking the shell', () => {
    const previous = { accessToken: 'old', user: { id: 'u' } } as Settings;
    const incoming = { accessToken: null, user: null } as Settings;

    const result = reconcileEmbeddedAccessToken(previous, incoming, now);

    expect(result.settings.accessToken).toBeNull();
    expect(result.requestFreshToken).toBe(false);
  });
});

describe('bindVisibleResume', () => {
  it('requests on visibility, focus while visible, and pageshow', () => {
    const doc = fakeTarget();
    const win = fakeTarget();
    const onResume = vi.fn();
    const stop = bindVisibleResume(onResume, { document: doc, window: win });

    doc.emit('visibilitychange');
    win.emit('focus');
    win.emit('pageshow');
    expect(onResume).toHaveBeenCalledTimes(3);

    doc.visibilityState = 'hidden';
    doc.emit('visibilitychange');
    win.emit('focus');
    expect(onResume).toHaveBeenCalledTimes(3);

    stop();
    doc.visibilityState = 'visible';
    doc.emit('visibilitychange');
    expect(onResume).toHaveBeenCalledTimes(3);
  });
});

describe('deliverSessionHandoff', () => {
  it('sends now, on the next turn, and after the mount retry', () => {
    const send = vi.fn();
    const queued: { fn: () => void; ms: number }[] = [];
    deliverSessionHandoff(
      send,
      (fn, ms) => {
        queued.push({ fn, ms });
        return queued.length as unknown as ReturnType<typeof setTimeout>;
      },
      () => undefined,
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(queued.map((item) => item.ms)).toEqual([0, SESSION_HANDOFF_RETRY_MS]);
    queued[0]?.fn();
    queued[1]?.fn();
    expect(send).toHaveBeenCalledTimes(3);
  });
});

describe('runNowAndSoon', () => {
  it('runs once now and once on the next scheduled turn', () => {
    const run = vi.fn();
    let queued: (() => void) | null = null;
    const cancel = runNowAndSoon(
      run,
      (fn) => {
        queued = fn;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      () => {
        queued = null;
      },
    );

    expect(run).toHaveBeenCalledTimes(1);
    queued?.();
    expect(run).toHaveBeenCalledTimes(2);
    cancel();
    expect(queued).toBeNull();
  });
});

describe('createSessionRequestGate', () => {
  it('coalesces bursts unless forced', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const gate = createSessionRequestGate(1000);
    const send = vi.fn();

    gate.request(send);
    gate.request(send);
    expect(send).toHaveBeenCalledTimes(1);

    gate.request(send, true);
    expect(send).toHaveBeenCalledTimes(2);

    vi.mocked(Date.now).mockReturnValue(2_000);
    gate.request(send);
    expect(send).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });
});
