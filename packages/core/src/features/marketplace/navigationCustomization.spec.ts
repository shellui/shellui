import { describe, expect, it } from 'vitest';
import type { NavigationItem } from '../config/types';
import { mergeNavigationOverlay } from './mergeNavigation';
import { movePathInOrder, nextHiddenPaths } from './navigationCustomization';
import { emptyNavigationOverlay } from './overlay';

describe('navigation customization', () => {
  it('moves a path up or down and refuses the ends of the list', () => {
    expect(movePathInOrder(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(movePathInOrder(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
    expect(movePathInOrder(['a', 'b'], 'a', 'up')).toBeNull();
    expect(movePathInOrder(['a', 'b'], 'missing', 'down')).toBeNull();
  });

  it('refuses to hide a locked path and toggles the others', () => {
    expect(nextHiddenPaths({ hiddenPaths: [], path: 'home', hidden: true, locked: true })).toEqual({
      ok: false,
      error: 'locked',
    });
    expect(
      nextHiddenPaths({ hiddenPaths: ['docs'], path: 'docs', hidden: false, locked: false }),
    ).toEqual({ ok: true, hiddenPaths: [] });
    expect(nextHiddenPaths({ hiddenPaths: [], path: 'docs', hidden: true, locked: false })).toEqual(
      { ok: true, hiddenPaths: ['docs'] },
    );
  });

  it('reorders items inside a group from the saved path order', () => {
    const docs: NavigationItem = { label: 'Docs', path: 'docs', url: 'https://docs.example/' };
    const blog: NavigationItem = { label: 'Blog', path: 'blog', url: 'https://blog.example/' };
    const merged = mergeNavigationOverlay(
      [{ title: 'Write', items: [docs, blog] }],
      { ...emptyNavigationOverlay(), order: ['blog', 'docs'] },
      null,
    );
    const group = merged[0];
    expect('items' in group && group.items.map((item) => item.path)).toEqual(['blog', 'docs']);
  });
});
