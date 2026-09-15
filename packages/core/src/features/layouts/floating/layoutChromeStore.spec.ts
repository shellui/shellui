import { describe, expect, it } from 'vitest';
import { buildFrameLayoutChrome } from './layoutChromeStore';
import {
  CHROME_ACTIONS_CONTENT_CLEARANCE,
  CHROME_ACTIONS_FAB_EDGE_MARGIN,
  CHROME_ACTIONS_FAB_GAP,
  CHROME_ACTIONS_FAB_SIZE_DESKTOP,
  CHROME_ACTIONS_TOP_BAR_HEIGHT,
  CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW,
  CHROME_ACTIONS_TOP_MARGIN,
  CHROME_ACTIONS_TOP_MARGIN_MINIMAL,
} from '../../chromeActions/computeActionInsets';
import {
  FLOATING_CONTENT_CLEARANCE,
  FLOATING_SIDEBAR_FIRST_NAV_TOP,
} from './computeFloatingInsets';

const CLEARED = {
  layout: 'none',
  viewport: 'desktop' as const,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  chromeVisible: false,
  autoPadding: true,
};

const FLOATING = {
  layout: 'floating',
  viewport: 'desktop' as const,
  insets: { top: 0, right: 0, bottom: 72, left: 280 },
  chromeVisible: true,
  autoPadding: true,
};

describe('buildFrameLayoutChrome', () => {
  it('promotes layout none → actions so sidebar/app-bar get safe padding', () => {
    const chrome = buildFrameLayoutChrome(CLEARED, { hasTop: true, hasPrimary: true });
    expect(chrome.layout).toBe('actions');
    expect(chrome.chromeVisible).toBe(true);
    expect(chrome.insets.top).toBe(
      CHROME_ACTIONS_TOP_MARGIN_MINIMAL +
        CHROME_ACTIONS_TOP_BAR_HEIGHT +
        CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
    expect(chrome.insets.bottom).toBe(
      CHROME_ACTIONS_FAB_EDGE_MARGIN + CHROME_ACTIONS_FAB_SIZE_DESKTOP + FLOATING_CONTENT_CLEARANCE,
    );
  });

  it('aligns floating desktop expanded actions with the first sidebar nav item', () => {
    const chrome = buildFrameLayoutChrome(FLOATING, { hasTop: true, hasPrimary: true });
    expect(chrome.layout).toBe('floating');
    expect(chrome.insets.left).toBe(280);
    expect(chrome.insets.top).toBe(
      FLOATING_SIDEBAR_FIRST_NAV_TOP +
        CHROME_ACTIONS_TOP_BAR_HEIGHT +
        CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
    // Desktop floating: FAB still sits above existing bottom inset (corner FAB).
    expect(chrome.insets.bottom).toBe(
      72 + CHROME_ACTIONS_FAB_SIZE_DESKTOP + CHROME_ACTIONS_FAB_GAP,
    );
  });

  it('keeps floating desktop collapsed near the expand chip', () => {
    const collapsed = {
      ...FLOATING,
      chromeVisible: false,
      insets: { ...FLOATING.insets, left: 0 },
    };
    const chrome = buildFrameLayoutChrome(collapsed, { hasTop: true, hasPrimary: false });
    expect(chrome.insets.top).toBe(
      CHROME_ACTIONS_TOP_MARGIN + CHROME_ACTIONS_TOP_BAR_HEIGHT + CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
  });

  it('does not stack FAB inset when floating phone/tablet docks the primary', () => {
    const mobileFloating = {
      ...FLOATING,
      viewport: 'mobile' as const,
      insets: { top: 0, right: 0, bottom: 88, left: 0 },
    };
    const chrome = buildFrameLayoutChrome(mobileFloating, { hasTop: true, hasPrimary: true });
    expect(chrome.insets.bottom).toBe(88);
    expect(chrome.insets.top).toBe(
      CHROME_ACTIONS_TOP_MARGIN_MINIMAL +
        CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW +
        CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
  });

  it('does not double-count floating safe-area top when merging action insets', () => {
    const safeTop = 47;
    const mobileFloating = {
      ...FLOATING,
      viewport: 'mobile' as const,
      insets: { top: safeTop, right: 0, bottom: 88, left: 0 },
    };
    const chrome = buildFrameLayoutChrome(mobileFloating, { hasTop: true, hasPrimary: true });
    expect(chrome.insets.top).toBe(
      safeTop + CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW + CHROME_ACTIONS_CONTENT_CLEARANCE,
    );
  });

  it('leaves cleared chrome unchanged when no actions', () => {
    expect(buildFrameLayoutChrome(CLEARED, { hasTop: false, hasPrimary: false })).toEqual(CLEARED);
  });

  it('skips top inset when actions live in the windows title bar', () => {
    const chrome = buildFrameLayoutChrome(
      CLEARED,
      { hasTop: true, hasPrimary: true },
      { topInTitleBar: true },
    );
    expect(chrome.layout).toBe('actions');
    expect(chrome.insets.top).toBe(0);
    expect(chrome.insets.bottom).toBeGreaterThan(0);
  });
});
