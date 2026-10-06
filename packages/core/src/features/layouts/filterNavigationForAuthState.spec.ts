import { describe, expect, it } from 'vitest';
import type { NavigationGroup, NavigationItem } from '../config/types';
import { filterNavigationForAuthState } from './utils';

const home: NavigationItem = { label: 'Home', path: '', url: 'http://localhost:5173/' };
const login: NavigationItem = { label: 'Sign in', path: 'sign-in', url: '/login' };
const dashboard: NavigationItem = {
  label: 'Dashboard',
  path: 'dashboard',
  url: 'http://localhost:5173/dashboard',
  hideWhenLoggedOut: true,
};
const accountGroup: NavigationGroup = { title: 'Account', items: [login, dashboard] };

const paths = (navigation: (NavigationItem | NavigationGroup)[]) =>
  navigation.flatMap((item) =>
    'items' in item ? item.items.map((navItem) => navItem.path) : [item.path],
  );

describe('filterNavigationForAuthState', () => {
  it('shows login entries and hides logged-in entries when signed out', () => {
    expect(paths(filterNavigationForAuthState([home, login, dashboard], false))).toEqual([
      '',
      'sign-in',
    ]);
  });

  it('hides login entries when signed in', () => {
    expect(paths(filterNavigationForAuthState([home, login, dashboard], true))).toEqual([
      '',
      'dashboard',
    ]);
  });

  it('hides login and logged-in entries while the session restore is loading', () => {
    expect(
      paths(filterNavigationForAuthState([home, login, dashboard], false, false, true)),
    ).toEqual(['']);
    expect(filterNavigationForAuthState([accountGroup], false, false, true)).toEqual([]);
  });
});
