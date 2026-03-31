import { describe, expect, it } from 'vitest';
import { toSettingsUser } from './toSettingsUser';

describe('toSettingsUser', () => {
  it('returns null when auth user is null', () => {
    expect(toSettingsUser(null)).toBeNull();
  });

  it('maps auth user fields into settings user shape', () => {
    const result = toSettingsUser({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: 'https://example.com/avatar.png',
      isStaff: false,
      authProvider: 'github',
    });

    expect(result).toEqual({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: 'https://example.com/avatar.png',
      authProvider: 'github',
    });
  });
});
