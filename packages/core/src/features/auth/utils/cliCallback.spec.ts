import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import {
  CLI_CALLBACK_PARAM,
  captureCliCallbackFromSearch,
  isLoopbackCliCallbackUrl,
  redirectCliCallbackError,
  redirectToCliCallback,
} from './cliCallback';

const createStorageMock = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
    clear: vi.fn(() => {
      data.clear();
    }),
    key: vi.fn(() => null),
    get length() {
      return data.size;
    },
  } as unknown as Storage;
};

describe('cliCallback', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: createStorageMock(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('isLoopbackCliCallbackUrl accepts only loopback http(s)', () => {
    expect(isLoopbackCliCallbackUrl('http://127.0.0.1:8765/callback')).toBe(true);
    expect(isLoopbackCliCallbackUrl('http://localhost/callback')).toBe(true);
    expect(isLoopbackCliCallbackUrl('http://[::1]/callback')).toBe(true);
    expect(isLoopbackCliCallbackUrl('https://evil.example/callback')).toBe(false);
    expect(isLoopbackCliCallbackUrl('not-a-url')).toBe(false);
  });

  test('capture + redirectToCliCallback assigns fragment tokens', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    captureCliCallbackFromSearch(
      `?${CLI_CALLBACK_PARAM}=${encodeURIComponent('http://127.0.0.1:9/callback')}`,
    );
    expect(
      redirectToCliCallback({
        accessToken: 'a',
        refreshToken: 'r',
        tokenType: 'bearer',
        expiresAt: 123,
      }),
    ).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
    const target = String(assign.mock.calls[0][0]);
    expect(target.startsWith('http://127.0.0.1:9/callback#')).toBe(true);
    expect(target).toContain('access_token=a');
    expect(target).toContain('refresh_token=r');
  });

  test('rejects non-loopback capture', () => {
    captureCliCallbackFromSearch(
      `?${CLI_CALLBACK_PARAM}=${encodeURIComponent('https://evil.example/x')}`,
    );
    expect(
      redirectToCliCallback({
        accessToken: 'a',
        refreshToken: 'r',
        tokenType: 'bearer',
        expiresAt: 1,
      }),
    ).toBe(false);
  });

  test('redirectCliCallbackError uses query params', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    captureCliCallbackFromSearch(
      `?${CLI_CALLBACK_PARAM}=${encodeURIComponent('http://127.0.0.1:9/callback')}`,
    );
    expect(redirectCliCallbackError('Nope', 'access_pending')).toBe(true);
    const target = String(assign.mock.calls[0][0]);
    expect(target).toContain('shellui_oauth_error=Nope');
    expect(target).toContain('shellui_oauth_error_code=access_pending');
  });
});
