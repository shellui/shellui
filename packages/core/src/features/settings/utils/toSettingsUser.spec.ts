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
      isCompanyOwner: false,
      authProvider: 'github',
      groups: [],
    });

    expect(result).toEqual({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: 'https://example.com/avatar.png',
      authProvider: 'github',
      groups: null,
    });

    const withGroups = toSettingsUser({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: null,
      isStaff: true,
      isCompanyOwner: false,
      authProvider: 'github',
      groups: ['beta', 'alpha'],
    });
    expect(withGroups).toEqual({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: null,
      authProvider: 'github',
      groups: ['beta', 'alpha'],
    });
  });
});
