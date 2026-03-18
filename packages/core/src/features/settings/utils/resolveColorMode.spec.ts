import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveColorMode } from './resolveColorMode';

describe('resolveColorMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns explicit dark and light values unchanged', () => {
    expect(resolveColorMode('dark')).toBe('dark');
    expect(resolveColorMode('light')).toBe('light');
  });

  it('resolves system to dark when media query matches', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });

    expect(resolveColorMode('system')).toBe('dark');
  });

  it('resolves system to light when media query does not match', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });

    expect(resolveColorMode('system')).toBe('light');
  });
});
