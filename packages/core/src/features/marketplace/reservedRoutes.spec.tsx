import { describe, expect, it, vi } from 'vitest';
import { matchRoutes } from 'react-router';
import type { ShellUIConfig } from '../config/types';
import { mergeNavigationOverlay } from './mergeNavigation';
import { reservedShellPaths } from './validationContext';
import { emptyNavigationOverlay, type InstalledAppRecord } from './overlay';
import { flattenNavigationItems } from '../layouts/utils';
import { createRoutes } from '../../routes/routes';
import { routeSignature } from '../../routes/routeSignature';

// `@shellui/config` is a virtual module that only the Vite build provides.
vi.mock('@shellui/config', () => ({ default: {} }));

const config: ShellUIConfig = {
  title: 'Shell',
  navigation: [{ label: 'Home', path: '', url: 'https://home.example/' }],
};

function hostileApp(id: string, path: string): InstalledAppRecord {
  return {
    id,
    name: id,
    origin: `https://${id}.example`,
    url: `https://${id}.example/`,
    path,
    thirdParty: true,
    capabilities: ['theme'],
    installedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const CORE_PATHS: Array<[string, string]> = [
  ['/admin', 'admin/*'],
  ['/admin/users', 'admin/*'],
  ['/__settings', '__settings/*'],
  ['/__settings/appearance', '__settings/*'],
  ['/__cookie-preferences', '__cookie-preferences'],
  ['/login', 'login'],
  ['/login/callback', 'login/callback'],
  ['/legal', 'legal'],
  ['/legal/privacy-policy', 'legal/privacy-policy'],
];

describe('core paths stay with the shell', () => {
  const hostile = [
    'admin',
    'admin/users',
    '__settings',
    '__settings/appearance',
    'legal/privacy-policy',
    'legal',
    'login',
    'files',
    'marketplace',
  ];
  const overlay = {
    ...emptyNavigationOverlay(),
    installedApps: hostile.map((path, index) => hostileApp(`evil${index}`, path)),
  };

  it('drops a stored app that claims a reserved path', () => {
    const merged = mergeNavigationOverlay(
      config.navigation,
      overlay,
      null,
      reservedShellPaths(config),
    );
    expect(flattenNavigationItems(merged).map((item) => item.path)).toEqual(['']);
  });

  it('still routes every core path to its core page', () => {
    const merged = mergeNavigationOverlay(
      config.navigation,
      { ...overlay, installedApps: [...overlay.installedApps, hostileApp('notes', 'notes')] },
      null,
      reservedShellPaths(config),
    );
    const routes = createRoutes({ ...config, navigation: merged });
    for (const [url, routePath] of CORE_PATHS) {
      const matches = matchRoutes(routes, url);
      expect(matches?.[matches.length - 1]?.route.path, url).toBe(routePath);
    }
    // A real app is served by the catch-all navigation route.
    const notes = matchRoutes(routes, '/notes');
    expect(notes?.[notes.length - 1]?.route.path).toBe('/notes/*');
  });

  it('follows a custom admin path and reserves it too', () => {
    const custom: ShellUIConfig = {
      ...config,
      backend: { adminPathname: '/console' },
    } as unknown as ShellUIConfig;
    expect(reservedShellPaths(custom)).toContain('/console');
    const merged = mergeNavigationOverlay(
      custom.navigation,
      { ...emptyNavigationOverlay(), installedApps: [hostileApp('evil', 'console')] },
      null,
      reservedShellPaths(custom),
    );
    expect(flattenNavigationItems(merged).map((item) => item.path)).toEqual(['']);
  });
});

describe('routeSignature', () => {
  const nav = [
    { label: 'A', path: 'a', url: 'https://a.example/' },
    { label: 'B', path: 'b', url: 'https://b.example/' },
  ];
  const base: ShellUIConfig = { ...config, navigation: nav };

  it('does not change when an item is reordered or hidden', () => {
    const reordered = { ...base, navigation: [nav[1], nav[0]] };
    const hidden = { ...base, navigation: [{ ...nav[0], hidden: true }, nav[1]] } as ShellUIConfig;
    expect(routeSignature(reordered)).toBe(routeSignature(base));
    expect(routeSignature(hidden)).toBe(routeSignature(base));
  });

  it('changes when a route is added or removed', () => {
    const more = {
      ...base,
      navigation: [...nav, { label: 'C', path: 'c', url: 'https://c.example/' }],
    };
    expect(routeSignature(more)).not.toBe(routeSignature(base));
    expect(routeSignature({ ...base, navigation: [nav[0]] })).not.toBe(routeSignature(base));
  });
});
