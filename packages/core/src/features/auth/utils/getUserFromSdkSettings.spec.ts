import { describe, expect, it, vi } from 'vitest';

vi.mock('@shellui/sdk', () => ({
  shellui: {
    initialSettings: null,
  },
}));

import { shellui } from '@shellui/sdk';
import { getAccessTokenFromSdkSettings, getUserFromSdkSettings } from './getUserFromSdkSettings';

describe('getUserFromSdkSettings', () => {
  it('returns null when sdk has no user', () => {
    (shellui as { initialSettings: unknown }).initialSettings = null;
    expect(getUserFromSdkSettings()).toBeNull();
  });

  it('returns user from sdk initial settings', () => {
    (shellui as { initialSettings: unknown }).initialSettings = {
      user: {
        id: 'u1',
        email: 'u1@example.com',
      },
      accessToken: 'jwt.from.initial.settings',
    };
    expect(getUserFromSdkSettings()).toEqual({
      id: 'u1',
      email: 'u1@example.com',
    });
    expect(getAccessTokenFromSdkSettings()).toBe('jwt.from.initial.settings');
  });
});
