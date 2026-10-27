import type { NavigationGroup, NavigationItem } from '../../config/types';

export interface MoreSection {
  /** Group the items came from, or null for top-level links. */
  group: NavigationGroup | null;
  items: NavigationItem[];
}

/**
 * Split the More overflow into runs that share a navigation group, so the
 * sheet and the tablet menu can show each group's label (order is kept).
 */
export function groupMoreItems(
  overflow: NavigationItem[],
  tree: (NavigationItem | NavigationGroup)[],
): MoreSection[] {
  const owner = new Map<NavigationItem, NavigationGroup>();
  for (const entry of tree) {
    if ('title' in entry && 'items' in entry) {
      for (const item of entry.items) owner.set(item, entry);
    }
  }
  const sections: MoreSection[] = [];
  for (const item of overflow) {
    const group = owner.get(item) ?? null;
    const last = sections[sections.length - 1];
    if (last && last.group === group) last.items.push(item);
    else sections.push({ group, items: [item] });
  }
  return sections;
}
