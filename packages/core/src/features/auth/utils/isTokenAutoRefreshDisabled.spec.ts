import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isTokenAutoRefreshDisabled } from './isTokenAutoRefreshDisabled';

const createStorageMock = (value: string | null) => {
  let stored = value;
  return {
    getItem: vi.fn((key: string) => (key === 'shellui:settings' ? stored : null)),
    setItem: vi.fn((_key: string, next: string) => {
      stored = next;
    }),
    removeItem: vi.fn(() => {
      stored = null;
    }),
    clear: vi.fn(() => {
      stored = null;
    }),
    key: vi.fn(() => null),
    length: 0,
  } as unknown as Storage;
};

describe('isTokenAutoRefreshDisabled', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(null),
    });
  });

  it('returns false when settings are missing', () => {
    expect(isTokenAutoRefreshDisabled()).toBe(false);
  });

  it('returns false when the flag is unset or false', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(JSON.stringify({ developerFeatures: { enabled: true } })),
    });
    expect(isTokenAutoRefreshDisabled()).toBe(false);

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(
        JSON.stringify({
          developerFeatures: { enabled: true, disableTokenAutoRefresh: false },
        }),
      ),
    });
    expect(isTokenAutoRefreshDisabled()).toBe(false);
  });

  it('returns true when the develop flag is enabled', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(
        JSON.stringify({
          developerFeatures: { enabled: true, disableTokenAutoRefresh: true },
        }),
      ),
    });
    expect(isTokenAutoRefreshDisabled()).toBe(true);
  });

  it('returns false when localStorage JSON is invalid', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock('{not-json'),
    });
    expect(isTokenAutoRefreshDisabled()).toBe(false);
  });
});
