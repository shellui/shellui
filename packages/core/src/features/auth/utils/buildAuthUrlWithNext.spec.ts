import { describe, expect, it } from 'vitest';
import urls from '../../../constants/urls';
import { buildAuthUrlWithNext } from './buildAuthUrlWithNext';

describe('buildAuthUrlWithNext', () => {
  it('returns the base path when next is null, undefined, or root', () => {
    expect(buildAuthUrlWithNext(urls.login, null)).toBe(urls.login);
    expect(buildAuthUrlWithNext(urls.login, undefined)).toBe(urls.login);
    expect(buildAuthUrlWithNext(urls.login, '/')).toBe(urls.login);
  });

  it('appends next when it points to a non-root path', () => {
    expect(buildAuthUrlWithNext(urls.login, '/dashboard')).toBe(`${urls.login}?next=%2Fdashboard`);
    expect(buildAuthUrlWithNext(urls.loginCallback, '/settings/user')).toBe(
      `${urls.loginCallback}?next=%2Fsettings%2Fuser`,
    );
  });
});
