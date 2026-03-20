import { describe, expect, it } from 'vitest';
import { formatProviderLabel } from './formatProviderLabel';

describe('formatProviderLabel', () => {
  it('formats known provider aliases', () => {
    expect(formatProviderLabel('github')).toBe('GitHub');
    expect(formatProviderLabel('twitter')).toBe('X');
    expect(formatProviderLabel('x')).toBe('X');
    expect(formatProviderLabel('facebook')).toBe('Meta');
    expect(formatProviderLabel('meta')).toBe('Meta');
    expect(formatProviderLabel('linkedin')).toBe('LinkedIn');
    expect(formatProviderLabel('linkedin_oidc')).toBe('LinkedIn');
  });

  it('capitalizes unknown providers', () => {
    expect(formatProviderLabel('google')).toBe('Google');
    expect(formatProviderLabel('apple')).toBe('Apple');
  });
});
