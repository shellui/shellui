import { describe, expect, it } from 'vitest';
import { normalizeRedirectPath } from './normalizeRedirectPath';

describe('normalizeRedirectPath', () => {
  it('keeps absolute paths unchanged', () => {
    expect(normalizeRedirectPath('/login')).toBe('/login');
  });

  it('prefixes relative paths with slash', () => {
    expect(normalizeRedirectPath('login')).toBe('/login');
  });
});
