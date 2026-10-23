import { describe, expect, it } from 'vitest';
import type { AuthSession } from '../types';
import { canRestoreStoredSession } from './canRestoreStoredSession';

const base = {
  accessToken: '',
  refreshToken: '',
  tokenType: 'bearer',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  provider: 'github',
} as unknown as AuthSession;

describe('canRestoreStoredSession', () => {
  it('rejects a profile without tokens, as seen in a new tab', () => {
    expect(canRestoreStoredSession(base, false)).toBe(false);
  });

  it('accepts a refresh token', () => {
    expect(canRestoreStoredSession({ ...base, refreshToken: 'r' }, false)).toBe(true);
  });

  it('accepts an access token', () => {
    expect(canRestoreStoredSession({ ...base, accessToken: 'a' }, false)).toBe(true);
  });

  it('accepts a token-less profile when BFF cookies can refresh it', () => {
    expect(canRestoreStoredSession(base, true)).toBe(true);
  });
});
