import { describe, expect, test } from 'vitest';
import {
  desktopAuthErrorMessage,
  desktopRedirectUri,
  normalizeDesktopScheme,
  parseDesktopAuthCallback,
} from './desktopAuthCallback';

const SCHEME = 'shellui-playground';

describe('desktop auth callback', () => {
  test('accepts a lowercase custom scheme and refuses browser schemes', () => {
    expect(normalizeDesktopScheme('shellui-playground')).toBe('shellui-playground');
    expect(normalizeDesktopScheme('com.example.desktop')).toBe('com.example.desktop');
    expect(normalizeDesktopScheme(' Shellui-Playground ')).toBeNull();
    expect(normalizeDesktopScheme('http')).toBeNull();
    expect(normalizeDesktopScheme('https')).toBeNull();
    expect(normalizeDesktopScheme('javascript')).toBeNull();
    expect(normalizeDesktopScheme('')).toBeNull();
    expect(desktopRedirectUri(SCHEME)).toBe('shellui-playground://callback');
  });

  test('reads shellui_auth_code and keeps the redirect used at the start', () => {
    const parsed = parseDesktopAuthCallback(
      'shellui-playground://callback?shellui_auth_code=one-time-code',
      SCHEME,
    );
    expect(parsed).toEqual({
      kind: 'code',
      authCode: 'one-time-code',
      redirectTo: 'shellui-playground://callback',
    });
  });

  test('maps ?error= to a message and does not treat it as a code', () => {
    const parsed = parseDesktopAuthCallback(
      'shellui-playground://callback?error=pkce_required',
      SCHEME,
    );
    expect(parsed?.kind).toBe('error');
    if (parsed?.kind !== 'error') return;
    expect(parsed.errorCode).toBe('pkce_required');
    expect(parsed.message).toBe(desktopAuthErrorMessage('pkce_required'));
    expect(parsed.message.toLowerCase()).not.toContain('one-time');
    expect(parsed).not.toHaveProperty('authCode');
    expect(parsed).not.toHaveProperty('codeVerifier');
  });

  test('treats shellui_oauth_error on the deep link as a failed sign-in', () => {
    const parsed = parseDesktopAuthCallback(
      'shellui-playground://callback?shellui_oauth_error=Sign-in%20stopped&shellui_oauth_error_code=pkce_required',
      SCHEME,
    );
    expect(parsed).toMatchObject({
      kind: 'error',
      errorCode: 'pkce_required',
    });
  });

  test('ignores a different scheme and a URL without a code', () => {
    expect(
      parseDesktopAuthCallback('other-app://callback?shellui_auth_code=abc', SCHEME),
    ).toBeNull();
    expect(parseDesktopAuthCallback('not a url', SCHEME)).toBeNull();
    const missing = parseDesktopAuthCallback('shellui-playground://callback', SCHEME);
    expect(missing).toMatchObject({ kind: 'error', errorCode: 'missing_auth_code' });
  });
});
