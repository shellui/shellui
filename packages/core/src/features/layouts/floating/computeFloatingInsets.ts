import type { LayoutChromeInsets, LayoutChromeViewport } from '@shellui/sdk';

/** Floating tab bar content height (icon + short label). */
export const FLOATING_TAB_BAR_HEIGHT = 56;
/** Gap between floating chrome and screen edge. */
export const FLOATING_CHROME_MARGIN = 12;
/**
 * Extra horizontal inset for the bottom nav so it doesn’t hug the window edge.
 * Applied on top of FLOATING_CHROME_MARGIN + safe-area.
 */
export const FLOATING_DOCK_SIDE_INSET = 8;
/** Extra clearance so the last content row clears the floating chrome comfortably. */
export const FLOATING_CONTENT_CLEARANCE = 12;
/** Desktop floating sidebar width. */
export const FLOATING_SIDEBAR_WIDTH = 240;
/**
 * Soft cap used as the initial slot guess before ResizeObserver measures.
 * Actual visible count is derived from available width / min slot width.
 */
export const FLOATING_MAX_TAB_SLOTS = 4;
/** Minimum equal-width slot for a bottom-nav tab (icon + readable label). */
export const FLOATING_MIN_TAB_SLOT_WIDTH = 76;

/**
 * Padding under the floating tab bar (chrome margin + safe-area).
 * Phone uses half so the bar sits lower on iPhone home-indicator devices.
 */
export function floatingTabBarBottomPadPx(
  safeBottom: number,
  viewport: LayoutChromeViewport,
): number {
  const full = FLOATING_CHROME_MARGIN + safeBottom;
  return viewport === 'mobile' ? full / 2 : full;
}

/**
 * Same bottom pad as the floating dock, as a CSS value so
 * `--shellui-safe-area-bottom` / env() apply on iPhone (not a snapped 0px number).
 */
export function floatingTabBarBottomPadCss(viewport: LayoutChromeViewport): string {
  if (viewport === 'mobile') {
    return `calc((${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-bottom, 0px)) / 2)`;
  }
  return `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-bottom, 0px))`;
}
/** Collapsed desktop toggle control size (glass chip). */
export const FLOATING_SIDEBAR_TOGGLE_SIZE = 36;
/**
 * Extra leading pad for chrome actions when the desktop sidebar is collapsed
 * (toggle size + clearance). Content itself stays full-bleed — only the action
 * row clears the expand chip.
 */
export const FLOATING_COLLAPSED_ACTIONS_LEADING_EXTRA =
  FLOATING_SIDEBAR_TOGGLE_SIZE + FLOATING_CONTENT_CLEARANCE;

export type FloatingSafeArea = LayoutChromeInsets;

export function computeFloatingInsets(options: {
  viewport: LayoutChromeViewport;
  chromeVisible: boolean;
  /** Desktop only: sidebar hidden — no left content inset (chip cleared by actions pad). */
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
        floatingTabBarBottomPadPx(safe.bottom, viewport) +
        FLOATING_TAB_BAR_HEIGHT +
        FLOATING_CHROME_MARGIN +
        FLOATING_CONTENT_CLEARANCE,
      left: safe.left,
    };
  }

  if (options.sidebarCollapsed) {
    return {
      top: safe.top,
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
