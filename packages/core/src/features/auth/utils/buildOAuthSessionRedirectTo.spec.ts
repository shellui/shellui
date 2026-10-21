import { describe, expect, test } from 'vitest';
import { SHELLUI_AUTH_CODE_PARAM } from '../constants/oauth';
import {
  buildOAuthSessionRedirectTo,
  resolveOAuthSessionRedirectTo,
} from './buildOAuthSessionRedirectTo';

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

describe('resolveOAuthSessionRedirectTo', () => {
  const start =
    'https://playground.shellui.com/login/callback?provider=github&shellui_pkce_flow=o0123';

  test('uses the stored start value when the host added a trailing slash', () => {
    expect(
      resolveOAuthSessionRedirectTo(
        start,
        'https://playground.shellui.com',
        '/login/callback/',
        '?provider=github&shellui_pkce_flow=o0123&shellui_auth_code=abc',
      ),
    ).toBe(start);
  });

  test('falls back to the current URL when nothing was stored', () => {
    expect(
      resolveOAuthSessionRedirectTo(
        null,
        'https://playground.shellui.com',
        '/login/callback/',
        '?provider=github&shellui_auth_code=abc',
      ),
    ).toBe('https://playground.shellui.com/login/callback/?provider=github');
  });

  test('ignores a stored value for another origin', () => {
    expect(
      resolveOAuthSessionRedirectTo(
        'https://evil.test/login/callback',
        'https://playground.shellui.com',
        '/login/callback',
        '?shellui_auth_code=abc',
      ),
    ).toBe('https://playground.shellui.com/login/callback');
  });
});
