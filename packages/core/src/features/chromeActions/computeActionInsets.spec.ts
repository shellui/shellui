import { describe, expect, it } from 'vitest';
import {
  actionChromeFlags,
  CHROME_ACTIONS_CONTENT_CLEARANCE,
  CHROME_ACTIONS_FAB_EDGE_MARGIN,
  CHROME_ACTIONS_FAB_SIZE,
  CHROME_ACTIONS_FAB_SIZE_DESKTOP,
  CHROME_ACTIONS_FAB_SIZE_SHELL,
  CHROME_ACTIONS_TOP_BAR_HEIGHT,
  CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW,
  CHROME_ACTIONS_TOP_MARGIN,
  CHROME_ACTIONS_TOP_MARGIN_MINIMAL,
  chromeActionsFabBottomOffsetCss,
  chromeActionsFabRightOffsetCss,
  chromeActionsShouldHonorSafeAreaTop,
  chromeActionsTopBarHeight,
  chromeActionsTopMargin,
  chromeActionsTopOffsetCss,
  computeActionInsets,
  mergeInsets,
} from './computeActionInsets';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_CONTENT_CLEARANCE,
  FLOATING_SIDEBAR_FIRST_NAV_TOP,
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

describe('chromeActionsTopMargin', () => {
  it('aligns floating desktop expanded with the first sidebar nav item', () => {
    expect(
      chromeActionsTopMargin({
        layout: 'floating',
        viewport: 'desktop',
        sidebarExpanded: true,
      }),
    ).toBe(FLOATING_SIDEBAR_FIRST_NAV_TOP);
  });

  it('keeps floating desktop collapsed near the expand chip', () => {
    expect(
      chromeActionsTopMargin({
        layout: 'floating',
        viewport: 'desktop',
        sidebarExpanded: false,
      }),
    ).toBe(CHROME_ACTIONS_TOP_MARGIN);
    expect(CHROME_ACTIONS_TOP_MARGIN).toBe(FLOATING_CHROME_MARGIN);
  });

  it('uses a minimal top margin for other layouts', () => {
    expect(chromeActionsTopMargin({ layout: 'actions', viewport: 'desktop' })).toBe(
      CHROME_ACTIONS_TOP_MARGIN_MINIMAL,
    );
    expect(chromeActionsTopMargin({ layout: 'floating', viewport: 'mobile' })).toBe(
      CHROME_ACTIONS_TOP_MARGIN_MINIMAL,
    );
  });
});

describe('chromeActionsTopOffsetCss', () => {
  it('skips safe-area on sidebar and app-bar (shell header band instead)', () => {
    expect(chromeActionsTopOffsetCss({ layout: 'sidebar', viewport: 'mobile' })).toBe(
      `calc(var(--shellui-shell-header-height, 0px) + ${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px)`,
    );
    expect(chromeActionsTopOffsetCss({ layout: 'app-bar', viewport: 'mobile' })).toBe(
      `calc(var(--shellui-shell-header-height, 0px) + ${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px)`,
    );
    // Inset card already clears the header tray — normal top gap only.
    expect(chromeActionsTopOffsetCss({ layout: 'sidebar-inset', viewport: 'mobile' })).toBe(
      `${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px`,
    );
  });

  it('honors safe-area on floating and fullscreen', () => {
    expect(chromeActionsTopOffsetCss({ layout: 'floating', viewport: 'mobile' })).toBe(
      `max(${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px, var(--shellui-safe-area-top, 0px))`,
    );
    expect(chromeActionsTopOffsetCss({ layout: 'fullscreen', viewport: 'mobile' })).toBe(
      `max(${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px, var(--shellui-safe-area-top, 0px))`,
    );
  });

  it('sits below the shell header band on flush sidebar and app-bar only', () => {
    expect(chromeActionsTopOffsetCss({ layout: 'sidebar', viewport: 'mobile' })).toBe(
      `calc(var(--shellui-shell-header-height, 0px) + ${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px)`,
    );
    expect(chromeActionsTopOffsetCss({ layout: 'app-bar-inset', viewport: 'mobile' })).toBe(
      `${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px`,
    );
  });

  it('allows forcing safe-area for overlay surfaces on header layouts', () => {
    expect(
      chromeActionsTopOffsetCss(
        { layout: 'sidebar', viewport: 'mobile' },
        { honorSafeAreaTop: true },
      ),
    ).toBe(`max(${CHROME_ACTIONS_TOP_MARGIN_MINIMAL}px, var(--shellui-safe-area-top, 0px))`);
  });
});

describe('chromeActionsShouldHonorSafeAreaTop', () => {
  it('matches layout chrome ownership of the status band', () => {
    expect(chromeActionsShouldHonorSafeAreaTop('floating')).toBe(true);
    expect(chromeActionsShouldHonorSafeAreaTop('fullscreen')).toBe(true);
    expect(chromeActionsShouldHonorSafeAreaTop('sidebar')).toBe(false);
    expect(chromeActionsShouldHonorSafeAreaTop('app-bar')).toBe(false);
  });
});

describe('chromeActionsTopBarHeight', () => {
  it('uses a taller row on phone and tablet', () => {
    expect(chromeActionsTopBarHeight('desktop')).toBe(CHROME_ACTIONS_TOP_BAR_HEIGHT);
    expect(chromeActionsTopBarHeight('mobile')).toBe(CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW);
    expect(chromeActionsTopBarHeight('tablet')).toBe(CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW);
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

  it('uses a taller top bar on mobile than desktop for non-floating layouts', () => {
    const desktop = computeActionInsets(
      { hasTop: true, hasPrimary: false },
      { viewport: 'desktop', layout: 'actions' },
    );
    const mobile = computeActionInsets(
      { hasTop: true, hasPrimary: false },
      { viewport: 'mobile', layout: 'actions' },
    );
    expect(desktop.top).toBe(
      CHROME_ACTIONS_TOP_MARGIN_MINIMAL +
        CHROME_ACTIONS_TOP_BAR_HEIGHT +
        CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
    expect(mobile.top).toBe(
      CHROME_ACTIONS_TOP_MARGIN_MINIMAL +
        CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW +
        CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
    expect(mobile.top).toBeGreaterThan(desktop.top);
  });

  it('aligns floating desktop expanded top inset with the first sidebar nav', () => {
    const top = computeActionInsets(
      { hasTop: true, hasPrimary: false },
      { viewport: 'desktop', layout: 'floating', sidebarExpanded: true },
    ).top;
    expect(top).toBe(
      FLOATING_SIDEBAR_FIRST_NAV_TOP +
        CHROME_ACTIONS_TOP_BAR_HEIGHT +
        CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
  });

  it('does not double-count existing safe-area top on floating phone', () => {
    const safeTop = 47;
    const extra = computeActionInsets(
      { hasTop: true, hasPrimary: false },
      {
        viewport: 'mobile',
        layout: 'floating',
        existingTopInset: safeTop,
      },
    ).top;
    // visualTop = max(8, 47) = 47; needed = 47+40+8 = 95; extra = 95-47 = 48
    expect(extra).toBe(CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW + CHROME_ACTIONS_CONTENT_CLEARANCE);
    expect(safeTop + extra).toBe(
      safeTop + CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW + CHROME_ACTIONS_CONTENT_CLEARANCE,
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

  it('uses a larger shell FAB on sidebar / app-bar layouts', () => {
    const sidebar = computeActionInsets(
      { hasTop: false, hasPrimary: true },
      { viewport: 'mobile', layout: 'sidebar' },
    );
    const appBar = computeActionInsets(
      { hasTop: false, hasPrimary: true },
      { viewport: 'mobile', layout: 'app-bar-inset' },
    );
    expect(sidebar.bottom).toBe(
      FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_SIZE_SHELL + FLOATING_CONTENT_CLEARANCE,
    );
    expect(appBar.bottom).toBe(sidebar.bottom);
    expect(sidebar.bottom).toBeGreaterThan(
      FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_SIZE + FLOATING_CONTENT_CLEARANCE,
    );
  });

  it('skips top inset when actions live in the title bar', () => {
    expect(
      computeActionInsets(
        { hasTop: true, hasPrimary: false },
        {
          viewport: 'mobile',
          layout: 'sidebar',
          existingTopInset: 90,
          topInTitleBar: true,
        },
      ).top,
    ).toBe(0);
  });

  it('adds safe-area-bottom for corner FABs when no existing bottom chrome', () => {
    expect(
      computeActionInsets(
        { hasTop: false, hasPrimary: true },
        { viewport: 'mobile', layout: 'actions', safeAreaBottom: 34 },
      ).bottom,
    ).toBe(FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_SIZE + FLOATING_CONTENT_CLEARANCE + 34);
  });

  it('does not add safe-area-bottom when stacking above an existing bottom inset', () => {
    expect(
      computeActionInsets(
        { hasTop: false, hasPrimary: true },
        { viewport: 'mobile', existingBottomInset: 88, safeAreaBottom: 34 },
      ).bottom,
    ).toBe(CHROME_ACTIONS_FAB_SIZE + 12);
  });

  it('stacks action-row inset on top of a mobile shell header band', () => {
    const headerBand = 91;
    expect(
      computeActionInsets(
        { hasTop: true, hasPrimary: false },
        { viewport: 'mobile', layout: 'sidebar', existingTopInset: headerBand },
      ).top,
    ).toBe(CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW + CHROME_ACTIONS_CONTENT_CLEARANCE);
  });

  it('builds FAB edge offsets that honor safe-area CSS vars', () => {
    expect(chromeActionsFabBottomOffsetCss(12)).toBe(
      'calc(12px + var(--shellui-safe-area-bottom, 0px))',
    );
    expect(chromeActionsFabRightOffsetCss(12, { useLayoutInsets: true })).toBe(
      'calc(12px + max(var(--shellui-inset-right, 0px), var(--shellui-safe-area-right, 0px)))',
    );
    expect(chromeActionsFabRightOffsetCss(12)).toBe(
      'calc(12px + var(--shellui-safe-area-right, 0px))',
    );
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
