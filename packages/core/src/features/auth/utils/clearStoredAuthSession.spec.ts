import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredAuthSession } from './clearStoredAuthSession';

describe('clearStoredAuthSession', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(() => null),
        length: 0,
      } as unknown as Storage,
    });
  });

  it('removes auth session from storage', () => {
    clearStoredAuthSession();
    expect(localStorage.removeItem).toHaveBeenCalledWith('shellui.auth.session');
  });
});
