import { describe, expect, test } from 'vitest';
import { hashHasOAuthTokens } from './hashHasOAuthTokens';

describe('hashHasOAuthTokens', () => {
  test('detects access + refresh in hash', () => {
    expect(hashHasOAuthTokens('#access_token=a&refresh_token=b')).toBe(true);
    expect(hashHasOAuthTokens('access_token=a&refresh_token=b')).toBe(true);
  });

  test('rejects incomplete hash', () => {
    expect(hashHasOAuthTokens('#access_token=a')).toBe(false);
    expect(hashHasOAuthTokens('#error=denied')).toBe(false);
    expect(hashHasOAuthTokens('')).toBe(false);
    expect(hashHasOAuthTokens(null)).toBe(false);
  });
});
