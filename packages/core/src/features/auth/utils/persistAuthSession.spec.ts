import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistAuthSession } from './persistAuthSession';
import type { AuthSession } from '../types';

const createStorageMock = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => data.set(key, value)),
    removeItem: vi.fn((key: string) => data.delete(key)),
    clear: vi.fn(() => data.clear()),
    key: vi.fn(() => null),
    get length() {
      return data.size;
    },
  } as unknown as Storage;
};

describe('persistAuthSession', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    });
  });

  it('stores session under auth storage key', () => {
    const session = { userId: '1' } as AuthSession;
    persistAuthSession(session);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'shellui.auth.session',
      JSON.stringify(session),
    );
  });
});
