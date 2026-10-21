import { describe, expect, test } from 'vitest';
import type { NavigationItem } from '../../config/types';
import { getLoginCancelTarget, isPublicNavigationPage } from './loginCancelTarget';

const item = (path: string, extra: Partial<NavigationItem> = {}): NavigationItem => ({
  label: path || 'Home',
  path,
  url: `/app/#/${path}`,
  ...extra,
});

describe('getLoginCancelTarget', () => {
  test('goes to / when the homepage is public', () => {
    expect(getLoginCancelTarget({ navigation: [item(''), item('docs')] })).toBe('/');
  });

  test('goes to / when there is no root item (HomeView)', () => {
    expect(getLoginCancelTarget({ navigation: [item('files', { requiresAuth: true })] })).toBe('/');
    expect(getLoginCancelTarget({ navigation: [] })).toBe('/');
    expect(getLoginCancelTarget(undefined)).toBe('/');
  });

  test('goes to the first public page when the homepage requires auth', () => {
    const navigation = [
      item('', { requiresAuth: true }),
      { title: 'Group', items: [item('files', { requiresAuth: true }), item('docs')] },
    ];
    expect(getLoginCancelTarget({ navigation })).toBe('/docs');
  });

  test('returns null when every page requires auth', () => {
    const navigation = [
      item('', { requiresAuth: true }),
      item('files', { requiresAuth: true }),
      item('admin', { requiresStaff: true }),
      item('private', { hideWhenLoggedOut: true }),
    ];
    expect(getLoginCancelTarget({ navigation })).toBeNull();
  });

  test('ignores settings, login, external, dev-mode and hidden entries', () => {
    const navigation = [
      item('', { requiresAuth: true }),
      item('settings', { url: '/__settings', openIn: 'modal' }),
      item('login', { url: '/login', openIn: 'modal' }),
      item('login-page', { url: '/login' }),
      item('website', { url: 'https://shellui.com/', openIn: 'external' }),
      item('drawer', { openIn: 'drawer' }),
      item('dev', { requiresDevMode: true }),
      item('secret', { hidden: true }),
    ];
    expect(getLoginCancelTarget({ navigation })).toBeNull();
  });

  test('follows start_url', () => {
    const navigation = [item('files', { requiresAuth: true }), item('docs')];
    expect(getLoginCancelTarget({ navigation, start_url: '/docs' })).toBe('/');
    expect(getLoginCancelTarget({ navigation, start_url: 'files' })).toBe('/docs');
    expect(
      getLoginCancelTarget({
        navigation: [item('files', { requiresAuth: true })],
        start_url: '/files',
      }),
    ).toBeNull();
  });
});

describe('isPublicNavigationPage', () => {
  test('plain page items are public', () => {
    expect(isPublicNavigationPage(item('docs'))).toBe(true);
    expect(isPublicNavigationPage(item('docs', { openIn: 'default' }))).toBe(true);
  });
});
