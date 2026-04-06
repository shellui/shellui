import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getShellUILoginClientTimezone, getShellUILoginDeviceId } from './clientLoginContext';

const createStorageMock = (store: Record<string, string>) =>
  ({
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    key: vi.fn(() => null),
    length: 0,
  }) as unknown as Storage;

describe('getShellUILoginClientTimezone', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns empty string on invalid or unknown timezone', () => {
    vi.stubGlobal('window', {});
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: 'not a/valid zone!' }),
        }) as Intl.DateTimeFormat,
    );
    expect(getShellUILoginClientTimezone()).toBe('');
  });

  it('returns normalized IANA id when valid', () => {
    vi.stubGlobal('window', {});
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: 'Europe/Paris' }),
        }) as Intl.DateTimeFormat,
    );
    expect(getShellUILoginClientTimezone()).toBe('Europe/Paris');
  });
});

describe('getShellUILoginDeviceId', () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => '11111111-2222-3333-4444-555555555555' },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
    vi.unstubAllGlobals();
  });

  it('persists and returns a new id when missing', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', createStorageMock(store));
    expect(getShellUILoginDeviceId()).toBe('11111111-2222-3333-4444-555555555555');
    expect(store.shellui_auth_client_device_id).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('reuses stored id when present', () => {
    const store: Record<string, string> = {
      shellui_auth_client_device_id: 'existing-id',
    };
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', createStorageMock(store));
    expect(getShellUILoginDeviceId()).toBe('existing-id');
  });
});
