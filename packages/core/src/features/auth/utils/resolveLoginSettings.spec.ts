import { describe, expect, it } from 'vitest';
import { resolveLoginSettings } from './resolveLoginSettings';

const url = 'https://auth.example.com';

describe('resolveLoginSettings', () => {
  it('keeps configured methods and normalizes providers', () => {
    expect(
      resolveLoginSettings({
        type: 'shellui',
        url,
        login: { methods: ['oauth'], oauthProviders: ['GitHub', 'github', ' '] },
      }),
    ).toEqual({ methods: ['oauth'], oauthProviders: ['github'], oauthClients: [] });
  });

  it('falls back to magic link when no method is configured', () => {
    expect(resolveLoginSettings({ type: 'shellui', url }).methods).toEqual(['magic_link']);
    expect(resolveLoginSettings({ type: 'supabase', url, login: { methods: [] } }).methods).toEqual(
      ['magic_link'],
    );
  });

  it('adds oauth to the fallback when providers are listed', () => {
    expect(
      resolveLoginSettings({ type: 'shellui', url, login: { oauthProviders: ['github'] } }),
    ).toEqual({ methods: ['oauth', 'magic_link'], oauthProviders: ['github'], oauthClients: [] });
  });

  it('shows nothing without a backend', () => {
    expect(resolveLoginSettings(undefined).methods).toEqual([]);
  });
});
