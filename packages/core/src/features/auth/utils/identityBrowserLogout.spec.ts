import { describe, expect, test } from 'vitest';
import type { NavigationItem } from '../../config/types';
import {
  buildIdentityBrowserLogoutUrl,
  finishShellSignOut,
  readIdentityLogoutUrl,
  resolveLogoutReturnTo,
} from './identityBrowserLogout';

const origin = 'https://app.example.com';

const item = (path: string, extra?: Partial<NavigationItem>): NavigationItem =>
  ({
    label: path || 'home',
    path,
    url: 'https://app.example.com/',
    ...extra,
  }) as NavigationItem;

describe('buildIdentityBrowserLogoutUrl', () => {
  test('encodes company_id and return_to and keeps an existing query', () => {
    const logout = buildIdentityBrowserLogoutUrl(
      'https://auth.example.com/oauth/logout?from=settings',
      '7',
      'https://app.example.com/docs?q=a+b&next=%2Fapps',
    );

    expect(logout).toBeTruthy();
    const url = new URL(logout as string);
    expect(`${url.origin}${url.pathname}`).toBe('https://auth.example.com/oauth/logout');
    expect(url.searchParams.get('from')).toBe('settings');
    expect(url.searchParams.get('company_id')).toBe('7');
    expect(url.searchParams.get('return_to')).toBe(
      'https://app.example.com/docs?q=a+b&next=%2Fapps',
    );
    expect(logout).toContain(
      `return_to=${encodeURIComponent('https://app.example.com/docs?q=a+b&next=%2Fapps')}`,
    );
    expect(logout).not.toContain(' ');
    expect(logout).not.toContain('#');
  });

  test('rejects a non-http logout URL, a bad company id, and a relative return', () => {
    expect(
      buildIdentityBrowserLogoutUrl('javascript:alert(1)', '7', 'https://app.example.com/'),
    ).toBe(null);
    expect(
      buildIdentityBrowserLogoutUrl(
        'https://auth.example.com/oauth/logout',
        'acme',
        'https://app.example.com/',
      ),
    ).toBe(null);
    expect(
      buildIdentityBrowserLogoutUrl('https://auth.example.com/oauth/logout', '7', '/docs'),
    ).toBe(null);
    expect(readIdentityLogoutUrl(' https://auth.example.com/oauth/logout ')).toBe(
      'https://auth.example.com/oauth/logout',
    );
    expect(readIdentityLogoutUrl('/oauth/logout')).toBeNull();
    expect(readIdentityLogoutUrl('https://user:pass@auth.example.com/oauth/logout')).toBeNull();
  });
});

describe('resolveLogoutReturnTo', () => {
  test('keeps a public page and strips auth params', () => {
    expect(
      resolveLogoutReturnTo({
        origin,
        pathname: '/docs',
        search: '?q=1&shellui_auth_code=one-time&shellui_pkce_flow=oabc',
        navigation: [item('docs')],
      }),
    ).toBe('https://app.example.com/docs?q=1');
  });

  test('uses the shell origin root for a guarded route and for the OAuth callback', () => {
    const navigation = [item(''), item('billing', { requiresAuth: true })];
    expect(
      resolveLogoutReturnTo({
        origin,
        pathname: '/billing/invoices',
        search: '?x=1',
        navigation,
      }),
    ).toBe('https://app.example.com/');
    expect(
      resolveLogoutReturnTo({
        origin,
        pathname: '/login/callback',
        search: '?shellui_auth_code=still-valid&next=%2Fapps',
        navigation,
      }),
    ).toBe('https://app.example.com/');
  });

  test('accepts an explicit same-origin path and rejects another origin', () => {
    expect(
      resolveLogoutReturnTo({
        origin,
        pathname: '/billing',
        search: '',
        navigation: [item('billing', { requiresAuth: true })],
        returnTo: '/login?next=%2F__settings%2Fuser',
      }),
    ).toBe('https://app.example.com/login?next=%2F__settings%2Fuser');
    expect(
      resolveLogoutReturnTo({
        origin,
        pathname: '/',
        search: '',
        returnTo: 'https://evil.example/phish',
      }),
    ).toBeNull();
  });
});

describe('finishShellSignOut', () => {
  test('revokes and clears before navigating', async () => {
    const order: string[] = [];
    const navigated = await finishShellSignOut({
      revoke: async () => {
        order.push('revoke');
      },
      clearLocal: () => {
        order.push('clear');
      },
      readBrowserLogoutUrl: async () => {
        order.push('settings');
        return 'https://auth.example.com/oauth/logout?company_id=7&return_to=https%3A%2F%2Fapp.example.com%2F';
      },
      navigate: () => {
        order.push('navigate');
      },
      initiatedHere: true,
    });

    expect(navigated).toBe(true);
    expect(order).toEqual(['revoke', 'clear', 'settings', 'navigate']);
  });

  test('still clears when revoke fails, and skips navigation without logout_url', async () => {
    const order: string[] = [];
    const navigated = await finishShellSignOut({
      revoke: async () => {
        order.push('revoke');
        throw new Error('offline');
      },
      clearLocal: () => {
        order.push('clear');
      },
      readBrowserLogoutUrl: async () => null,
      navigate: () => {
        order.push('navigate');
      },
      initiatedHere: true,
    });

    expect(navigated).toBe(false);
    expect(order).toEqual(['revoke', 'clear']);
  });

  test('a tab that did not start sign-out clears tokens and does not navigate', async () => {
    const order: string[] = [];
    const navigated = await finishShellSignOut({
      revoke: async () => {
        order.push('revoke');
      },
      clearLocal: () => {
        order.push('clear');
      },
      readBrowserLogoutUrl: async () => {
        order.push('settings');
        return 'https://auth.example.com/oauth/logout';
      },
      navigate: () => {
        order.push('navigate');
      },
      initiatedHere: false,
    });

    expect(navigated).toBe(false);
    expect(order).toEqual(['revoke', 'clear']);
  });
});
