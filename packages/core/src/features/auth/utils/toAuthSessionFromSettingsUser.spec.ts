import { describe, expect, it, vi } from 'vitest';
import { toAuthSessionFromSettingsUser } from './toAuthSessionFromSettingsUser';
import type { SettingsUser } from '@shellui/sdk';

const toBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');

const shelluiJwtWithGroups = () => {
  const payload = {
    user_metadata: {
      is_staff: true,
      groups: ['team-a', 'team-b'],
    },
  };
  return `header.${toBase64Url(JSON.stringify(payload))}.signature`;
};

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

    const session = toAuthSessionFromSettingsUser(settingsUser, 'jwt.example.token');
    expect(session.userId).toBe('user-1');
    expect(session.userEmail).toBe('user@example.com');
    expect(session.userName).toBe('Demo User');
    expect(session.userAvatarUrl).toBe('https://example.com/avatar.png');
    expect(session.userIsStaff).toBe(false);
    expect(session.userGroups).toEqual([]);
    expect(session.provider).toBe('google');
    expect(session.tokenType).toBe('bearer');
    expect(session.accessToken).toBe('jwt.example.token');
    expect(session.refreshToken).toBe('');
    expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    vi.useRealTimers();
  });

  it('reads groups and staff from ShellUI JWT user_metadata when present', () => {
    const settingsUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Demo User',
      profilePicture: null,
      authProvider: 'github',
    } as SettingsUser;

    const session = toAuthSessionFromSettingsUser(settingsUser, shelluiJwtWithGroups());
    expect(session.userIsStaff).toBe(true);
    expect(session.userGroups).toEqual(['team-a', 'team-b']);
  });

  it('prefers explicit settings user groups over JWT when both are set', () => {
    const settingsUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Demo User',
      profilePicture: null,
      authProvider: 'github',
      groups: ['from-settings', 'alpha'],
    } as SettingsUser;

    const session = toAuthSessionFromSettingsUser(settingsUser, shelluiJwtWithGroups());
    expect(session.userGroups).toEqual(['alpha', 'from-settings']);
  });
});
