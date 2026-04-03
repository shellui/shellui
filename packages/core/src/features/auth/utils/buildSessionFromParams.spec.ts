import { describe, expect, it } from 'vitest';
import { buildSessionFromParams } from './buildSessionFromParams';

const toBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');

const createToken = () => {
  const payload = {
    sub: 'user-id',
    email: 'user@example.com',
    app_metadata: { provider: 'github' },
    user_metadata: {
      name: 'Jane',
      avatar_url: 'https://example.com/avatar.png',
      is_staff: true,
      groups: ['editors', 'admin'],
      shelluiPreferences: {
        themeName: 'default',
        language: 'fr',
        region: 'Europe/Paris',
        colorScheme: 'dark',
      },
    },
  };
  return `header.${toBase64Url(JSON.stringify(payload))}.signature`;
};

describe('buildSessionFromParams', () => {
  it('returns session data when required params exist', () => {
    const params = new URLSearchParams({
      access_token: createToken(),
      refresh_token: 'refresh-token',
      expires_in: '3600',
      token_type: 'bearer',
    });

    const session = buildSessionFromParams(params, 1_000);
    expect(session).not.toBeNull();
    expect(session?.refreshToken).toBe('refresh-token');
    expect(session?.provider).toBe('github');
    expect(session?.userId).toBe('user-id');
    expect(session?.userEmail).toBe('user@example.com');
    expect(session?.userName).toBe('Jane');
    expect(session?.userAvatarUrl).toBe('https://example.com/avatar.png');
    expect(session?.userIsStaff).toBe(true);
    expect(session?.userPreferences).toEqual({
      themeName: 'default',
      language: 'fr',
      region: 'Europe/Paris',
      colorScheme: 'dark',
    });
    expect(session?.userGroups).toEqual(['admin', 'editors']);
    expect(session?.expiresAt).toBe(4_600);
  });

  it('returns null when access or refresh token is missing', () => {
    const params = new URLSearchParams({ access_token: 'a' });
    expect(buildSessionFromParams(params, 1_000)).toBeNull();
  });
});
