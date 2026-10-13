import { describe, expect, it } from 'vitest';
import { accessTokenRefreshDue, PROACTIVE_REFRESH_LEEWAY_SECONDS } from './accessTokenRefreshDue';

describe('accessTokenRefreshDue', () => {
  const now = 1_700_000_000;

  it('is due inside the leeway and when already expired', () => {
    expect(accessTokenRefreshDue(now + PROACTIVE_REFRESH_LEEWAY_SECONDS, now)).toBe(true);
    expect(accessTokenRefreshDue(now - 5, now)).toBe(true);
  });

  it('is not due while the token still has more than the leeway left', () => {
    expect(accessTokenRefreshDue(now + PROACTIVE_REFRESH_LEEWAY_SECONDS + 1, now)).toBe(false);
  });
});
