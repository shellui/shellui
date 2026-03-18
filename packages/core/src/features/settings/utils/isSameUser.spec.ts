import { describe, expect, it } from 'vitest';
import { isSameUser } from './isSameUser';

describe('isSameUser', () => {
  it('returns true when both users are null', () => {
    expect(isSameUser(null, null)).toBe(true);
  });

  it('returns false when one user is missing', () => {
    expect(
      isSameUser(
        {
          id: 'u1',
          email: 'test@example.com',
          name: 'Test',
          profilePicture: null,
          authProvider: 'github',
        },
        null,
      ),
    ).toBe(false);
  });

  it('returns true when all user fields are identical', () => {
    const user = {
      id: 'u1',
      email: 'test@example.com',
      name: 'Test',
      profilePicture: null,
      authProvider: 'github',
    };

    expect(isSameUser(user, { ...user })).toBe(true);
  });
});
