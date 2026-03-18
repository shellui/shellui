import { describe, expect, it, vi } from 'vitest';
import { isSessionExpired } from './isSessionExpired';
import type { AuthSession } from '../types';

describe('isSessionExpired', () => {
  it('returns false when session expires well in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const now = Math.floor(Date.now() / 1000);
    const session = { expiresAt: now + 120 } as AuthSession;
    expect(isSessionExpired(session)).toBe(false);
    vi.useRealTimers();
  });

  it('returns true when session is already expired or in grace window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const now = Math.floor(Date.now() / 1000);
    const nearExpirySession = { expiresAt: now + 20 } as AuthSession;
    expect(isSessionExpired(nearExpirySession)).toBe(true);
    vi.useRealTimers();
  });
});
