import { describe, expect, it } from 'vitest';
import { buildFrameLayoutChrome } from './layoutChromeStore';
import {
  CHROME_ACTIONS_FAB_GAP,
  CHROME_ACTIONS_FAB_SIZE,
  CHROME_ACTIONS_TOP_BAR_HEIGHT,
  CHROME_ACTIONS_TOP_MARGIN,
  CHROME_ACTIONS_TOP_MARGIN_MOBILE,
} from '../../chromeActions/computeActionInsets';
import { FLOATING_CHROME_MARGIN, FLOATING_CONTENT_CLEARANCE } from './computeFloatingInsets';

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
      CHROME_ACTIONS_TOP_MARGIN + CHROME_ACTIONS_TOP_BAR_HEIGHT + FLOATING_CONTENT_CLEARANCE,
    );
    expect(chrome.insets.bottom).toBe(
      FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_SIZE + FLOATING_CONTENT_CLEARANCE,
    );
  });

  it('keeps floating layout and stacks action insets on nav insets', () => {
    const chrome = buildFrameLayoutChrome(FLOATING, { hasTop: true, hasPrimary: true });
    expect(chrome.layout).toBe('floating');
    expect(chrome.insets.left).toBe(280);
    expect(chrome.insets.top).toBe(
      CHROME_ACTIONS_TOP_MARGIN + CHROME_ACTIONS_TOP_BAR_HEIGHT + FLOATING_CONTENT_CLEARANCE,
    );
    // Desktop floating: FAB still sits above existing bottom inset (corner FAB).
    expect(chrome.insets.bottom).toBe(72 + CHROME_ACTIONS_FAB_SIZE + CHROME_ACTIONS_FAB_GAP);
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
      CHROME_ACTIONS_TOP_MARGIN_MOBILE + CHROME_ACTIONS_TOP_BAR_HEIGHT + FLOATING_CONTENT_CLEARANCE,
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
