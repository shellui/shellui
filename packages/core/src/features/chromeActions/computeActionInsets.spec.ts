import { describe, expect, it } from 'vitest';
import {
  actionChromeFlags,
  CHROME_ACTIONS_FAB_EDGE_MARGIN,
  CHROME_ACTIONS_FAB_SIZE,
  CHROME_ACTIONS_FAB_SIZE_DESKTOP,
  CHROME_ACTIONS_TOP_BAR_HEIGHT,
  CHROME_ACTIONS_TOP_MARGIN,
  computeActionInsets,
  mergeInsets,
} from './computeActionInsets';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_CONTENT_CLEARANCE,
} from '../layouts/floating/computeFloatingInsets';
import {
  clearAllChromeActions,
  clearChromeActionsForFrame,
  getAllChromeActions,
  getChromeActionsForFrame,
  setChromeActionsForFrame,
} from './chromeActionsStore';

describe('chromeActionsStore', () => {
  it('stores and clears per frame', () => {
    clearAllChromeActions();
    setChromeActionsForFrame('a', { title: 'A', primary: { id: 'p', icon: 'plus' } });
    setChromeActionsForFrame('b', { title: 'B' });
    expect(getChromeActionsForFrame('a')?.title).toBe('A');
    expect(getAllChromeActions()).toHaveLength(2);
    expect(clearChromeActionsForFrame('a')).toBe(true);
    expect(getChromeActionsForFrame('a')).toBeNull();
    expect(getAllChromeActions()).toHaveLength(1);
    clearAllChromeActions();
    expect(getAllChromeActions()).toHaveLength(0);
  });

  it('drops empty payloads', () => {
    clearAllChromeActions();
    setChromeActionsForFrame('a', { title: 'A' });
    setChromeActionsForFrame('a', {});
    expect(getChromeActionsForFrame('a')).toBeNull();
  });
});

describe('computeActionInsets', () => {
  it('detects top and primary flags', () => {
    expect(actionChromeFlags(null)).toEqual({ hasTop: false, hasPrimary: false });
    expect(actionChromeFlags({ frameUuid: 'x', title: 'T' })).toEqual({
      hasTop: true,
      hasPrimary: false,
    });
    expect(actionChromeFlags({ frameUuid: 'x', primary: { id: 'p' } })).toEqual({
      hasTop: false,
      hasPrimary: true,
    });
  });

  it('adds top inset unless title-bar mode', () => {
    const withTop = computeActionInsets({ hasTop: true, hasPrimary: false });
    expect(withTop.top).toBeGreaterThanOrEqual(CHROME_ACTIONS_TOP_BAR_HEIGHT);
    expect(
      computeActionInsets({ hasTop: true, hasPrimary: false }, { topInTitleBar: true }).top,
    ).toBe(0);
  });

  it('uses a shared top margin on mobile and desktop', () => {
    const desktop = computeActionInsets(
      { hasTop: true, hasPrimary: false },
      { viewport: 'desktop' },
    );
    const mobile = computeActionInsets({ hasTop: true, hasPrimary: false }, { viewport: 'mobile' });
    expect(mobile.top).toBe(desktop.top);
    expect(mobile.top).toBe(
      CHROME_ACTIONS_TOP_MARGIN + CHROME_ACTIONS_TOP_BAR_HEIGHT + FLOATING_CONTENT_CLEARANCE,
    );
  });

  it('stacks FAB above existing bottom inset', () => {
    const alone = computeActionInsets({ hasTop: false, hasPrimary: true });
    const stacked = computeActionInsets(
      { hasTop: false, hasPrimary: true },
      { existingBottomInset: 100 },
    );
    expect(stacked.bottom).toBe(CHROME_ACTIONS_FAB_SIZE + 12);
    expect(alone.bottom).toBeGreaterThan(stacked.bottom);
  });

  it('uses a larger FAB + edge margin on tablet and desktop', () => {
    const desktop = computeActionInsets(
      { hasTop: false, hasPrimary: true },
      { viewport: 'desktop' },
    );
    const mobile = computeActionInsets({ hasTop: false, hasPrimary: true }, { viewport: 'mobile' });
    expect(desktop.bottom).toBe(
      CHROME_ACTIONS_FAB_EDGE_MARGIN + CHROME_ACTIONS_FAB_SIZE_DESKTOP + FLOATING_CONTENT_CLEARANCE,
    );
    expect(mobile.bottom).toBe(
      FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_SIZE + FLOATING_CONTENT_CLEARANCE,
    );
    expect(desktop.bottom).toBeGreaterThan(mobile.bottom);
  });

  it('skips FAB bottom inset when primary is in the floating dock', () => {
    expect(
      computeActionInsets(
        { hasTop: false, hasPrimary: true },
        { existingBottomInset: 88, primaryInDock: true },
      ).bottom,
    ).toBe(0);
  });

  it('merges insets additively', () => {
    expect(
      mergeInsets(
        { top: 1, right: 2, bottom: 3, left: 4 },
        { top: 10, right: 20, bottom: 30, left: 40 },
      ),
    ).toEqual({ top: 11, right: 22, bottom: 33, left: 44 });
  });
});
