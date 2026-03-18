import { describe, expect, it, vi } from 'vitest';
import { toAuthSessionFromSettingsUser } from './toAuthSessionFromSettingsUser';
import type { SettingsUser } from '@shellui/sdk';

describe('toAuthSessionFromSettingsUser', () => {
  it('maps settings user fields into an auth session', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const settingsUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Demo User',
      profilePicture: 'https://example.com/avatar.png',
      authProvider: 'google',
    } as SettingsUser;

    const session = toAuthSessionFromSettingsUser(settingsUser);
    expect(session.userId).toBe('user-1');
    expect(session.userEmail).toBe('user@example.com');
    expect(session.userName).toBe('Demo User');
    expect(session.userAvatarUrl).toBe('https://example.com/avatar.png');
    expect(session.provider).toBe('google');
    expect(session.tokenType).toBe('bearer');
    expect(session.accessToken).toBe('');
    expect(session.refreshToken).toBe('');
    expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    vi.useRealTimers();
  });
});
