import type { LayoutChromeInsets, LayoutChromeViewport } from '@shellui/sdk';

/** Floating tab bar content height (icon + label). */
export const FLOATING_TAB_BAR_HEIGHT = 56;
/** Gap between floating chrome and screen edge. */
export const FLOATING_CHROME_MARGIN = 12;
/** Extra clearance so the last content row clears the floating chrome comfortably. */
export const FLOATING_CONTENT_CLEARANCE = 12;
/** Desktop floating sidebar width. */
export const FLOATING_SIDEBAR_WIDTH = 240;
/** Max primary tab items before “More”. */
export const FLOATING_MAX_TAB_ITEMS = 5;
/** Collapsed desktop toggle control size (glass chip). */
export const FLOATING_SIDEBAR_TOGGLE_SIZE = 36;
/**
 * Top inset when the desktop sidebar is collapsed — clears the floating
 * expand chip so content does not sit under it.
 */
export const FLOATING_COLLAPSED_TOP_INSET =
  FLOATING_CHROME_MARGIN + FLOATING_SIDEBAR_TOGGLE_SIZE + FLOATING_CONTENT_CLEARANCE;

export type FloatingSafeArea = LayoutChromeInsets;

export function computeFloatingInsets(options: {
  viewport: LayoutChromeViewport;
  chromeVisible: boolean;
  /** Desktop only: sidebar fully hidden; left inset drops to safe-area. */
  sidebarCollapsed?: boolean;
  safeArea?: Partial<FloatingSafeArea>;
}): LayoutChromeInsets {
  const safe: FloatingSafeArea = {
    top: options.safeArea?.top ?? 0,
    right: options.safeArea?.right ?? 0,
    bottom: options.safeArea?.bottom ?? 0,
    left: options.safeArea?.left ?? 0,
  };

  if (!options.chromeVisible) {
    return { ...safe };
  }

  const { viewport } = options;
  if (viewport === 'mobile' || viewport === 'tablet') {
    return {
      top: safe.top,
      right: safe.right,
      bottom:
        safe.bottom +
        FLOATING_TAB_BAR_HEIGHT +
        FLOATING_CHROME_MARGIN * 2 +
        FLOATING_CONTENT_CLEARANCE,
      left: safe.left,
    };
  }

  if (options.sidebarCollapsed) {
    return {
      top: safe.top + FLOATING_COLLAPSED_TOP_INSET,
      right: safe.right,
      bottom: safe.bottom,
      left: safe.left,
    };
  }

  return {
    top: safe.top,
    right: safe.right,
    bottom: safe.bottom,
    left:
      safe.left + FLOATING_SIDEBAR_WIDTH + FLOATING_CHROME_MARGIN * 2 + FLOATING_CONTENT_CLEARANCE,
  };
}

/** Read shell safe-area CSS vars as pixel numbers (0 when unavailable). */
export function readShellSafeAreaPx(el: HTMLElement = document.documentElement): FloatingSafeArea {
  const styles = getComputedStyle(el);
  const parse = (name: string): number => {
    const raw = styles.getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: parse('--shellui-safe-area-top'),
    right: parse('--shellui-safe-area-right'),
    bottom: parse('--shellui-safe-area-bottom'),
    left: parse('--shellui-safe-area-left'),
  };
}
