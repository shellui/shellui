import { describe, expect, it } from 'vitest';
import urls from '../../../constants/urls';
import { normalizeNextPath } from './normalizeNextPath';

describe('normalizeNextPath', () => {
  it('keeps valid absolute paths', () => {
    expect(normalizeNextPath('/')).toBe('/');
    expect(normalizeNextPath('/dashboard')).toBe('/dashboard');
  });

  it('rejects invalid or unsafe next paths', () => {
    expect(normalizeNextPath(null)).toBeNull();
    expect(normalizeNextPath('dashboard')).toBeNull();
    expect(normalizeNextPath('//evil.example.com')).toBeNull();
  });

  it('rejects login route loops', () => {
    expect(normalizeNextPath(urls.login)).toBeNull();
    expect(normalizeNextPath(`${urls.login}?next=%2Fhome`)).toBeNull();
  });
});
