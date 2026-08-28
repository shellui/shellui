import { describe, expect, it } from 'vitest';
import type { NavigationItem } from '../config/types';
import { findMatchingNavigationItem, getActivePathPrefix, getNavPathPrefix } from './utils';

const root: NavigationItem = {
  label: 'Home',
  path: '',
  url: 'http://localhost:5173/#/',
};

const home: NavigationItem = {
  label: 'Home',
  path: 'home',
  url: 'http://localhost:5173/#/',
};

const themes: NavigationItem = {
  label: 'Themes',
  path: 'themes',
  url: 'http://localhost:5173/#/themes',
};

describe('findMatchingNavigationItem', () => {
  const items = [root, home, themes];

  it('matches root at /', () => {
    expect(findMatchingNavigationItem(items, '/')?.path).toBe('');
  });

  it('keeps deep links under / on the root app (not 404 / redirect)', () => {
    expect(findMatchingNavigationItem(items, '/layout')?.path).toBe('');
    expect(findMatchingNavigationItem(items, '/foo/bar')?.path).toBe('');
  });

  it('prefers a more specific nav path over root', () => {
    expect(findMatchingNavigationItem(items, '/home')?.path).toBe('home');
    expect(findMatchingNavigationItem(items, '/home/settings')?.path).toBe('home');
    expect(findMatchingNavigationItem(items, '/themes')?.path).toBe('themes');
    expect(findMatchingNavigationItem(items, '/themes/colors')?.path).toBe('themes');
  });

  it('returns undefined when nothing matches and there is no root item', () => {
    expect(findMatchingNavigationItem([home, themes], '/unknown')).toBeUndefined();
  });
});

describe('getActivePathPrefix', () => {
  it('uses longest prefix including root deep links', () => {
    const items = [root, home, themes];
    expect(getActivePathPrefix('/', items)).toBe('/');
    expect(getActivePathPrefix('/layout', items)).toBe('/');
    expect(getActivePathPrefix('/home/x', items)).toBe('/home');
    expect(getNavPathPrefix(root)).toBe('/');
  });
});
