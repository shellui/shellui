import { describe, expect, it } from 'vitest';
import { isShellOwnedPath } from './isShellOwnedPath';

describe('isShellOwnedPath', () => {
  it('matches settings and nested settings routes', () => {
    expect(isShellOwnedPath('/__settings')).toBe(true);
    expect(isShellOwnedPath('/__settings/')).toBe(true);
    expect(isShellOwnedPath('/__settings/developpers')).toBe(true);
    expect(isShellOwnedPath('/__settings/appearance')).toBe(true);
  });

  it('matches other shell pages', () => {
    expect(isShellOwnedPath('/login')).toBe(true);
    expect(isShellOwnedPath('/admin')).toBe(true);
    expect(isShellOwnedPath('/legal/privacy-policy')).toBe(true);
  });

  it('rejects embedded app paths', () => {
    expect(isShellOwnedPath('/')).toBe(false);
    expect(isShellOwnedPath('/home')).toBe(false);
    expect(isShellOwnedPath('/dashboard')).toBe(false);
  });
});
