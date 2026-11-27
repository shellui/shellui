import { describe, expect, it } from 'vitest';
import type { NavigationItem } from '../config/types';
import { createMarketplaceNavigationItem, mergeNavigationOverlay } from './mergeNavigation';
import { emptyNavigationOverlay, parseNavigationOverlay, type InstalledAppRecord } from './overlay';

const context = {
  now: '2026-01-01T00:00:00.000Z',
  shellOrigin: 'https://shell.example',
};

const home: NavigationItem = {
  label: 'Home',
  path: 'home',
  url: 'https://home.example/',
  locked: true,
};

const docs: NavigationItem = {
  label: 'Docs',
  path: 'docs',
  url: 'https://docs.example/',
};

function app(partial: Partial<InstalledAppRecord> = {}): InstalledAppRecord {
  return {
    id: 'notes',
    name: 'Notes',
    origin: 'https://notes.example',
    url: 'https://notes.example/app/',
    path: 'notes',
    thirdParty: true,
    capabilities: ['theme', 'locale'],
    installedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('mergeNavigationOverlay', () => {
  it('adds the marketplace route and installed apps, and keeps locked items visible', () => {
    const overlay = {
      ...emptyNavigationOverlay('2026-01-02T00:00:00.000Z'),
      installedApps: [app()],
      order: ['notes', 'home', 'docs', 'marketplace'],
      hiddenPaths: ['home', 'docs'],
    };
    const merged = mergeNavigationOverlay(
      [docs, home],
      overlay,
      createMarketplaceNavigationItem('https://marketplace.shellui.com'),
    );
    const paths = merged.map((entry) => ('path' in entry ? entry.path : ''));
    expect(paths).toEqual(['notes', 'home', 'docs', 'marketplace']);
    const homeItem = merged.find(
      (entry) => 'path' in entry && entry.path === 'home',
    ) as NavigationItem;
    const docsItem = merged.find(
      (entry) => 'path' in entry && entry.path === 'docs',
    ) as NavigationItem;
    const notesItem = merged.find(
      (entry) => 'path' in entry && entry.path === 'notes',
    ) as NavigationItem;
    expect(homeItem.hidden).toBeUndefined();
    expect(homeItem.locked).toBe(true);
    expect(docsItem.hidden).toBe(true);
    expect(notesItem.safeForAuthToken).toBeUndefined();
    expect(notesItem.childFrames).toBeUndefined();
    expect(notesItem.url).toBe('https://notes.example/app/');
    expect(notesItem.label).toEqual({ en: 'Notes (third-party)', fr: 'Notes (tiers)' });
  });

  it('drops inline SVG icons from installed apps', () => {
    const overlay = {
      ...emptyNavigationOverlay(),
      installedApps: [app({ icon: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' })],
    };
    const merged = mergeNavigationOverlay([], overlay, null);
    const notes = merged[0] as NavigationItem;
    expect(notes.icon).toBeUndefined();
  });
});

describe('parseNavigationOverlay', () => {
  const doc = (installedApps: unknown[]) => ({
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    order: [],
    hiddenPaths: [],
    installedApps,
  });

  it('drops a stored app that asks for auth instead of silently trimming it', () => {
    const parsed = parseNavigationOverlay(
      doc([{ ...app(), capabilities: ['theme', 'locale', 'auth'] }, app({ id: 'ok', path: 'ok' })]),
      context,
    );
    expect(parsed?.installedApps.map((entry) => entry.id)).toEqual(['ok']);
  });

  it('never carries unknown fields such as safeForAuthToken or childFrames', () => {
    const parsed = parseNavigationOverlay(
      doc([
        { ...app(), safeForAuthToken: true, childFrames: { origins: ['https://evil.example'] } },
      ]),
      context,
    );
    expect(parsed?.installedApps[0]).not.toHaveProperty('safeForAuthToken');
    expect(parsed?.installedApps[0]).not.toHaveProperty('childFrames');
  });

  it('rejects a non-https remote app url, a first-party record, and the shell origin', () => {
    const parsed = parseNavigationOverlay(
      doc([
        app({ url: 'http://notes.example/app', origin: 'http://notes.example' }),
        { ...app({ id: 'first', path: 'first' }), thirdParty: false },
        app({
          id: 'self',
          path: 'self',
          url: 'https://shell.example/x',
          origin: 'https://shell.example',
        }),
      ]),
      context,
    );
    expect(parsed?.installedApps).toEqual([]);
  });

  it('refuses a layout over 100 apps', () => {
    const many = Array.from({ length: 101 }, (_, n) =>
      app({
        id: `app-${n}`,
        path: `app-${n}`,
        url: `https://a${n}.example/`,
        origin: `https://a${n}.example`,
      }),
    );
    expect(parseNavigationOverlay(doc(many), context)).toBeNull();
  });
});
