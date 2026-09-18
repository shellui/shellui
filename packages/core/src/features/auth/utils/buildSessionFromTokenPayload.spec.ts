import { describe, expect, test } from 'vitest';
import { buildSessionFromTokenPayload } from './buildSessionFromTokenPayload';

describe('buildSessionFromTokenPayload', () => {
  test('maps token JSON to AuthSession', () => {
    const now = 1_700_000_000;
    const session = buildSessionFromTokenPayload(
      {
        access_token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MSIsImVtYWlsIjoidUBleC5jb20ifQ.sig',
        refresh_token: 'refresh-1',
        expires_at: now + 300,
        token_type: 'bearer',
      },
      now,
    );
    expect(session?.accessToken).toBe(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MSIsImVtYWlsIjoidUBleC5jb20ifQ.sig',
    );
    expect(session?.refreshToken).toBe('refresh-1');
    expect(session?.expiresAt).toBe(now + 300);
    expect(session?.userId).toBe('u1');
    expect(session?.userEmail).toBe('u@ex.com');
  });

  test('returns null when tokens are missing', () => {
    expect(buildSessionFromTokenPayload({ access_token: 'only-access' }, 0)).toBeNull();
  });
});
