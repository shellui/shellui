import { describe, expect, it } from 'vitest';
import { getPreferredBackendProvider } from './getPreferredBackendProvider';

describe('getPreferredBackendProvider', () => {
  it('maps frontend aliases to backend provider ids', () => {
    expect(getPreferredBackendProvider('x')).toBe('twitter');
    expect(getPreferredBackendProvider('meta')).toBe('facebook');
    expect(getPreferredBackendProvider('linkedin')).toBe('linkedin_oidc');
  });

  it('returns normalized provider for regular providers', () => {
    expect(getPreferredBackendProvider('github')).toBe('github');
    expect(getPreferredBackendProvider('Google')).toBe('google');
  });
});
