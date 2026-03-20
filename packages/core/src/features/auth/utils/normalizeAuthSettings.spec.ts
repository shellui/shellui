import { describe, expect, it } from 'vitest';
import { normalizeAuthSettings } from './normalizeAuthSettings';

describe('normalizeAuthSettings', () => {
  it('normalizes settings payload to supported methods and oauth providers', () => {
    const payload = {
      methods: ['password', 'oauth', 'unknown'],
      external: {
        github: true,
        google: true,
        email: true,
      },
      enable_magic_link: true,
    };

    const result = normalizeAuthSettings(payload);
    expect(result.methods).toEqual(expect.arrayContaining(['password', 'oauth', 'magic_link']));
    expect(result.oauthProviders).toEqual(expect.arrayContaining(['github', 'google']));
    expect(result.oauthProviders).not.toContain('email');
  });

  it('supports array payloads and handles invalid values', () => {
    expect(normalizeAuthSettings([])).toEqual({ methods: [], oauthProviders: [] });

    const result = normalizeAuthSettings([{ loginMethod: 'both', oauth_provider: 'GitLab' }]);
    expect(result.methods).toEqual(expect.arrayContaining(['password', 'oauth']));
    expect(result.oauthProviders).toEqual(['gitlab']);
  });

  it('detects web3-enabled providers in settings payload', () => {
    const payload = {
      external: {
        ethereum: true,
      },
    };
    const result = normalizeAuthSettings(payload);
    expect(result.methods).toEqual(expect.arrayContaining(['web3']));
  });
});
