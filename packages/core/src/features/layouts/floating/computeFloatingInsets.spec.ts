import { describe, expect, it } from 'vitest';
import {
  computeFloatingInsets,
  FLOATING_CHROME_MARGIN,
  FLOATING_CONTENT_CLEARANCE,
  FLOATING_SIDEBAR_WIDTH,
  FLOATING_TAB_BAR_HEIGHT,
} from './computeFloatingInsets';

describe('computeFloatingInsets', () => {
  const safe = { top: 10, right: 2, bottom: 20, left: 3 };

  it('returns safe area only when chrome is hidden', () => {
    expect(
      computeFloatingInsets({ viewport: 'mobile', chromeVisible: false, safeArea: safe }),
    ).toEqual(safe);
    expect(
      computeFloatingInsets({ viewport: 'tablet', chromeVisible: false, safeArea: safe }),
    ).toEqual(safe);
    expect(
      computeFloatingInsets({ viewport: 'desktop', chromeVisible: false, safeArea: safe }),
    ).toEqual(safe);
  });

  it('adds bottom tab bar on mobile when visible', () => {
    expect(
      computeFloatingInsets({ viewport: 'mobile', chromeVisible: true, safeArea: safe }),
    ).toEqual({
      top: 10,
      right: 2,
      bottom:
        20 + FLOATING_TAB_BAR_HEIGHT + FLOATING_CHROME_MARGIN * 2 + FLOATING_CONTENT_CLEARANCE,
      left: 3,
    });
  });

  it('adds bottom tab bar on tablet when visible (same as mobile)', () => {
    expect(
      computeFloatingInsets({ viewport: 'tablet', chromeVisible: true, safeArea: safe }),
    ).toEqual({
      top: 10,
      right: 2,
      bottom:
        20 + FLOATING_TAB_BAR_HEIGHT + FLOATING_CHROME_MARGIN * 2 + FLOATING_CONTENT_CLEARANCE,
      left: 3,
    });
  });

  it('adds left sidebar on desktop when visible', () => {
    expect(
      computeFloatingInsets({ viewport: 'desktop', chromeVisible: true, safeArea: safe }),
    ).toEqual({
      top: 10,
      right: 2,
      bottom: 20,
      left: 3 + FLOATING_SIDEBAR_WIDTH + FLOATING_CHROME_MARGIN * 2 + FLOATING_CONTENT_CLEARANCE,
    });
  });
});
