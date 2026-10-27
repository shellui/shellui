import { describe, expect, it } from 'vitest';
import { pickVisibleEntries } from './appBarOverflow';

const base = { widths: [60, 60, 60, 60, 60], moreWidth: 32, gap: 4 };

describe('pickVisibleEntries', () => {
  it('shows everything when it fits', () => {
    expect(pickVisibleEntries({ ...base, available: 400 })).toEqual([0, 1, 2, 3, 4]);
  });

  it('fills in order and leaves room for More', () => {
    // budget 200 - 4 - 32 = 164: two 60px items plus a gap.
    expect(pickVisibleEntries({ ...base, available: 200 })).toEqual([0, 1]);
  });

  it('keeps the active entry visible when it would overflow', () => {
    expect(pickVisibleEntries({ ...base, available: 200, activeIndex: 4 })).toEqual([0, 4]);
  });

  it('keeps order when the active entry already fits', () => {
    expect(pickVisibleEntries({ ...base, available: 200, activeIndex: 1 })).toEqual([0, 1]);
  });

  it('returns nothing when even the active entry does not fit', () => {
    expect(pickVisibleEntries({ ...base, available: 60, activeIndex: 2 })).toEqual([]);
  });
});
