import { describe, expect, it } from 'vitest';
import { getOAuthProviderCandidates } from './getOAuthProviderCandidates';

describe('getOAuthProviderCandidates', () => {
  it('returns aliases for supported provider families', () => {
    expect(getOAuthProviderCandidates('x')).toEqual(['x', 'twitter']);
    expect(getOAuthProviderCandidates('twitter')).toEqual(['twitter', 'x']);
    expect(getOAuthProviderCandidates('meta')).toEqual(['meta', 'facebook']);
    expect(getOAuthProviderCandidates('linkedin')).toEqual(['linkedin', 'linkedin_oidc']);
  });

  it('returns a normalized single candidate for unknown providers', () => {
    expect(getOAuthProviderCandidates('GitHub')).toEqual(['github']);
    expect(getOAuthProviderCandidates('google')).toEqual(['google']);
  });
});
