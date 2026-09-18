import { describe, expect, test } from 'vitest';
import { SHELLUI_AUTH_CODE_PARAM } from '../constants/oauth';
import { buildOAuthSessionRedirectTo } from './buildOAuthSessionRedirectTo';

describe('buildOAuthSessionRedirectTo', () => {
  test('strips shellui_auth_code and keeps other query params', () => {
    const search = `?provider=github&next=%2F&${SHELLUI_AUTH_CODE_PARAM}=abc123`;
    expect(buildOAuthSessionRedirectTo('http://localhost:4000', '/login/callback', search)).toBe(
      'http://localhost:4000/login/callback?provider=github&next=%2F',
    );
  });

  test('returns pathname-only URL when only auth code was present', () => {
    expect(
      buildOAuthSessionRedirectTo(
        'http://127.0.0.1:8765',
        '/callback',
        `?${SHELLUI_AUTH_CODE_PARAM}=one-time`,
      ),
    ).toBe('http://127.0.0.1:8765/callback');
  });
});
