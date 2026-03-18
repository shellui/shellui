import { describe, expect, it } from 'vitest';
import type { NavigationGroup, NavigationItem } from '../../config/types';
import { flattenNavigationItems } from './flattenNavigationItems';

describe('flattenNavigationItems', () => {
  it('returns empty list when navigation is empty', () => {
    expect(flattenNavigationItems([])).toEqual([]);
  });

  it('flattens grouped and standalone navigation items', () => {
    const docsItem: NavigationItem = { label: 'Docs', path: '/docs', url: '/docs' };
    const blogItem: NavigationItem = { label: 'Blog', path: '/blog', url: '/blog' };
    const group: NavigationGroup = { title: 'Group', items: [docsItem] };

    expect(flattenNavigationItems([group, blogItem])).toEqual([docsItem, blogItem]);
  });
});
