import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStoredAuthSession } from './readStoredAuthSession';

const createStorageMock = (value: string | null) =>
  ({
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(() => null),
    length: 0,
  }) as unknown as Storage;

describe('readStoredAuthSession', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(null),
    });
  });

  it('returns null when there is no stored session', () => {
    expect(readStoredAuthSession()).toBeNull();
  });

  it('parses and returns stored session data', () => {
    const stored = JSON.stringify({ userId: 'u1', expiresAt: 123 });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(stored),
    });
    expect(readStoredAuthSession()).toEqual({ userId: 'u1', expiresAt: 123 });
  });
});
