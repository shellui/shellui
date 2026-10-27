import { describe, expect, it } from 'vitest';
import type { NavigationGroup, NavigationItem } from '../../config/types';
import { groupMoreItems } from './moreSections';

const item = (path: string): NavigationItem => ({ path, url: `/${path}`, label: path });

describe('groupMoreItems', () => {
  const files = item('files');
  const members = item('members');
  const roles = item('roles');
  const help = item('help');
  const team: NavigationGroup = { title: 'Team', items: [members, roles] };
  const tree = [item('home'), files, team, help];

  it('labels the runs that belong to a group and keeps the order', () => {
    const sections = groupMoreItems([files, members, roles, help], tree);
    expect(sections.map((s) => s.group?.title ?? null)).toEqual([null, 'Team', null]);
    expect(sections[1].items).toEqual([members, roles]);
  });

  it('returns one unlabelled section when nothing is grouped', () => {
    expect(groupMoreItems([files, help], tree)).toEqual([{ group: null, items: [files, help] }]);
  });

  it('returns nothing for an empty overflow', () => {
    expect(groupMoreItems([], tree)).toEqual([]);
  });
});
