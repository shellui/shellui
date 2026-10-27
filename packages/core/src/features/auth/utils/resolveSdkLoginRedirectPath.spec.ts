import { describe, expect, it } from 'vitest';
import urls from '../../../constants/urls';
import { resolveSdkLoginRedirectPath } from './resolveSdkLoginRedirectPath';

describe('resolveSdkLoginRedirectPath', () => {
  it('returns to the callback with the current page as next', () => {
    expect(resolveSdkLoginRedirectPath(undefined, '/account')).toBe(
      `${urls.loginCallback}?next=%2Faccount`,
    );
    expect(resolveSdkLoginRedirectPath('', '/files?tab=shared')).toBe(
      `${urls.loginCallback}?next=%2Ffiles%3Ftab%3Dshared`,
    );
  });

  it('uses redirectPath as the page after sign-in', () => {
    expect(resolveSdkLoginRedirectPath('/dashboard', '/account')).toBe(
      `${urls.loginCallback}?next=%2Fdashboard`,
    );
  });

  it('keeps an explicit callback path', () => {
    const callback = `${urls.loginCallback}?next=%2Fapps`;
    expect(resolveSdkLoginRedirectPath(callback, '/account')).toBe(callback);
    expect(resolveSdkLoginRedirectPath(urls.loginCallback, '/account')).toBe(urls.loginCallback);
  });

  it('falls back to the current page when redirectPath is the login page', () => {
    expect(resolveSdkLoginRedirectPath(urls.login, '/account')).toBe(
      `${urls.loginCallback}?next=%2Faccount`,
    );
  });

  it('never sends people back to login or to another origin', () => {
    expect(resolveSdkLoginRedirectPath(undefined, urls.login)).toBe(urls.loginCallback);
    expect(resolveSdkLoginRedirectPath(undefined, '/')).toBe(urls.loginCallback);
    expect(resolveSdkLoginRedirectPath('//evil.example.com', '/account')).toBe(
      `${urls.loginCallback}?next=%2Faccount`,
    );
    expect(resolveSdkLoginRedirectPath('https://evil.example.com', '/')).toBe(urls.loginCallback);
  });
});
