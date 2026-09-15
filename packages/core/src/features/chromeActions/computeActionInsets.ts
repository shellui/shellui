import type { LayoutChromeInsets, LayoutChromeViewport } from '@shellui/sdk';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_CONTENT_CLEARANCE,
  FLOATING_SIDEBAR_FIRST_NAV_TOP,
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_HEIGHT_TABLET,
  floatingTabBarHeight,
} from '../layouts/floating/computeFloatingInsets';
import type { FrameChromeActions } from './chromeActionsStore';

/** Top floating action row height — desktop overlay (`h-8` / `size-8`). */
export const CHROME_ACTIONS_TOP_BAR_HEIGHT = 32;
/** Top action row height — phone/tablet (`h-10` / `size-10`), closer to dock scale. */
export const CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW = 40;
/**
 * Default top breathing room (floating desktop collapsed chip alignment).
 * Applied as `max(margin, safe-area-top)` so notched phones keep the system
 * inset without stacking extra pad.
 */
export const CHROME_ACTIONS_TOP_MARGIN = FLOATING_CHROME_MARGIN;
/**
 * Minimal top gap for non-floating layouts (sidebar / app-bar / fullscreen)
 * and floating phone/tablet — shell chrome already frames the content.
 */
export const CHROME_ACTIONS_TOP_MARGIN_MINIMAL = 8;
/** @deprecated Use chromeActionsTopMargin() — kept for call sites / tests. */
export const CHROME_ACTIONS_TOP_MARGIN_MOBILE = CHROME_ACTIONS_TOP_MARGIN_MINIMAL;
/**
 * Extra space below the action row before iframe content starts.
 * Smaller than floating-nav clearance — the scrim already separates chrome from content.
 */
export const CHROME_ACTIONS_CONTENT_CLEARANCE = 8;
/**
 * Extra scrim height below the action row. With `from-70%`, this band fades
 * background → transparent so content eases in under the chrome.
 */
export const CHROME_ACTIONS_TOP_SCRIM_FADE = 24;
/** Bottom primary action button size (default shadcn icon / overlays). */
export const CHROME_ACTIONS_FAB_SIZE = 40;
/** Floating phone FAB — equal to `FLOATING_TAB_BAR_HEIGHT`. */
export const CHROME_ACTIONS_FAB_SIZE_FLOATING = FLOATING_TAB_BAR_HEIGHT;
/** Tablet FAB — equal to `FLOATING_TAB_BAR_HEIGHT_TABLET`. */
export const CHROME_ACTIONS_FAB_SIZE_LARGE = FLOATING_TAB_BAR_HEIGHT_TABLET;
/** Desktop FAB (main frame) — between compact and tablet. */
export const CHROME_ACTIONS_FAB_SIZE_DESKTOP = 52;
/**
 * Edge inset for tablet/desktop FAB (right + bottom).
 * Mobile keeps `FLOATING_CHROME_MARGIN` so it sits flush with the dock band.
 */
export const CHROME_ACTIONS_FAB_EDGE_MARGIN = 20;
/** Gap between primary FAB and floating tab bar (corner FAB uses edge margin). */
export const CHROME_ACTIONS_FAB_GAP = 12;

export type ChromeActionsTopContext = {
  viewport?: LayoutChromeViewport;
  /** Published layout id (`floating`, `actions`, `none`, …). */
  layout?: string;
  /**
   * Floating desktop only: when true, align with the first sidebar nav item.
   * When false (sidebar collapsed), keep the chip-aligned near-top margin.
   */
  sidebarExpanded?: boolean;
};

/** Top action control row height for the given viewport. */
export function chromeActionsTopBarHeight(viewport?: LayoutChromeViewport): number {
  if (viewport === 'mobile' || viewport === 'tablet') return CHROME_ACTIONS_TOP_BAR_HEIGHT_NARROW;
  return CHROME_ACTIONS_TOP_BAR_HEIGHT;
}

/**
 * Top offset above the action row.
 * Floating desktop + expanded sidebar → first nav item; collapsed → chip margin;
 * everything else → minimal gap.
 */
export function chromeActionsTopMargin(
  context?: ChromeActionsTopContext | LayoutChromeViewport,
): number {
  // Legacy call signature: chromeActionsTopMargin(viewport)
  if (typeof context === 'string' || context === undefined) {
    return CHROME_ACTIONS_TOP_MARGIN_MINIMAL;
  }

  const { viewport, layout, sidebarExpanded } = context;
  if (layout === 'floating' && viewport === 'desktop') {
    return sidebarExpanded === false ? CHROME_ACTIONS_TOP_MARGIN : FLOATING_SIDEBAR_FIRST_NAV_TOP;
  }
  return CHROME_ACTIONS_TOP_MARGIN_MINIMAL;
}

/**
 * Whether the action row should clear the device status band via safe-area-top.
 * Floating / fullscreen are full-bleed under the notch. Sidebar and app-bar
 * already pad their shell headers into the status band — the content iframe
 * starts below that chrome, so stacking safe-area again leaves a large empty gap
 * on iPhone.
 */
export function chromeActionsShouldHonorSafeAreaTop(layout?: string): boolean {
  if (!layout) return true;
  if (layout === 'floating' || layout === 'fullscreen') return true;
  if (
    layout === 'sidebar' ||
    layout === 'sidebar-inset' ||
    layout === 'app-bar' ||
    layout === 'app-bar-inset'
  ) {
    return false;
  }
  // Promoted `actions` / `none` snapshots while on a header layout: prefer the
  // shell layout string from settings when available; default to no extra inset.
  if (layout === 'actions' || layout === 'none') return false;
  return true;
}

/**
 * CSS length for the top action row offset.
 * When honoring safe-area: `max(margin, safe-area-top)` so notched phones clear
 * the status band without double-padding the margin on zero-inset devices.
 * When the shell header already cleared safe-area: plain margin only.
 * When a mobile overlay header is present (`--shellui-shell-header-height`), sit
 * just below that band so actions clear the shell top bar.
 */
export function chromeActionsTopOffsetCss(
  context?: ChromeActionsTopContext | LayoutChromeViewport,
  options?: { honorSafeAreaTop?: boolean },
): string {
  const min = chromeActionsTopMargin(context);
  const layout = typeof context === 'object' && context ? context.layout : undefined;
  const honor = options?.honorSafeAreaTop ?? chromeActionsShouldHonorSafeAreaTop(layout);
  const isShellHeaderLayout =
    layout === 'sidebar' ||
    layout === 'sidebar-inset' ||
    layout === 'app-bar' ||
    layout === 'app-bar-inset';
  if (isShellHeaderLayout) {
    // Modal overlays force honorSafeAreaTop and skip the shell header band.
    if (options?.honorSafeAreaTop) {
      return `max(${min}px, var(--shellui-safe-area-top, 0px))`;
    }
    // Inset cards already start below the header tray — actions use a normal top gap.
    if (layout === 'sidebar-inset' || layout === 'app-bar-inset') {
      return `${min}px`;
    }
    // Flush sidebar / app-bar: actions sit just under the overlay header band.
    return `calc(var(--shellui-shell-header-height, 0px) + ${min}px)`;
  }
  if (!honor) return `${min}px`;
  return `max(${min}px, var(--shellui-safe-area-top, 0px))`;
}

/** Main-frame FAB diameter by viewport (overlays stay at `CHROME_ACTIONS_FAB_SIZE`). */
export function chromeActionsFabSize(
  viewport?: LayoutChromeViewport,
  options?: { floatingDock?: boolean },
): number {
  if (viewport === 'desktop') return CHROME_ACTIONS_FAB_SIZE_DESKTOP;
  // Tablet + phone floating dock: match the bottom nav bar height exactly.
  if (viewport === 'tablet' || options?.floatingDock) {
    return floatingTabBarHeight(viewport === 'tablet' ? 'tablet' : 'mobile');
  }
  return CHROME_ACTIONS_FAB_SIZE;
}

/** Outer margin from the screen / frame edge for the main-frame FAB. */
export function chromeActionsFabEdgeMargin(viewport?: LayoutChromeViewport): number {
  if (viewport === 'tablet' || viewport === 'desktop') return CHROME_ACTIONS_FAB_EDGE_MARGIN;
  return FLOATING_CHROME_MARGIN;
}

/**
 * Bottom offset for a corner FAB (non-dock). Always clears the home indicator via
 * safe-area — sidebar / app-bar / fullscreen iframes go edge-to-edge on iPhone.
 */
export function chromeActionsFabBottomOffsetCss(edgeMargin: number): string {
  return `calc(${edgeMargin}px + var(--shellui-safe-area-bottom, 0px))`;
}

/**
 * Trailing offset for a corner FAB.
 * When layout insets are applied, take the larger of inset-right and safe-area-right
 * so floating (inset already includes safe) and sidebar (inset 0) both clear the edge.
 */
export function chromeActionsFabRightOffsetCss(
  edgeMargin: number,
  options?: { useLayoutInsets?: boolean },
): string {
  if (options?.useLayoutInsets) {
    return `calc(${edgeMargin}px + max(var(--shellui-inset-right, 0px), var(--shellui-safe-area-right, 0px)))`;
  }
  return `calc(${edgeMargin}px + var(--shellui-safe-area-right, 0px))`;
}

export type ActionChromeFlags = {
  hasTop: boolean;
  hasPrimary: boolean;
};

export function actionChromeFlags(
  actions: FrameChromeActions | null | undefined,
): ActionChromeFlags {
  if (!actions) return { hasTop: false, hasPrimary: false };
  const hasTop =
    Boolean(actions.back) || Boolean(actions.title) || Boolean(actions.trailing?.length);
  return { hasTop, hasPrimary: Boolean(actions.primary) };
}

/**
 * Extra insets so iframe content clears floating action chrome.
 * Callers merge this on top of floating-nav (or other layout) insets.
 */
export function computeActionInsets(
  flags: ActionChromeFlags,
  options?: {
    /** When true, top actions live in the window title bar — no top inset. */
    topInTitleBar?: boolean;
    /** Existing bottom inset (e.g. floating tab bar) so FAB sits above it. */
    existingBottomInset?: number;
    /**
     * Existing top inset already published (e.g. floating safe-area-top).
     * Action extras are computed as total needed minus this, so we don’t
     * double-count safe-area when visual offset is `max(margin, safe-area)`.
     */
    existingTopInset?: number;
    /**
     * Primary FAB shares the floating bottom band (corner, beside the nav) —
     * no extra bottom inset beyond the dock height.
     */
    primaryInDock?: boolean;
    /** Viewport for top margin / bar height / FAB sizing. */
    viewport?: LayoutChromeViewport;
    /** Published layout id (`floating`, `actions`, …). */
    layout?: string;
    /** Floating desktop: sidebar expanded (align to first nav) vs collapsed. */
    sidebarExpanded?: boolean;
    /**
     * Device safe-area-bottom (px). Added when the FAB is not docked and no
     * existing bottom chrome already cleared the home indicator.
     */
    safeAreaBottom?: number;
  },
): LayoutChromeInsets {
  const viewport = options?.viewport;
  const layout = options?.layout;
  const topMargin = chromeActionsTopMargin({
    viewport,
    layout,
    sidebarExpanded: options?.sidebarExpanded,
  });
  const barHeight = chromeActionsTopBarHeight(viewport);
  const baseTop = options?.existingTopInset ?? 0;
  const honorSafe = chromeActionsShouldHonorSafeAreaTop(layout);
  const isShellHeaderLayout =
    layout === 'sidebar' ||
    layout === 'sidebar-inset' ||
    layout === 'app-bar' ||
    layout === 'app-bar-inset';

  let top = 0;
  if (flags.hasTop && !options?.topInTitleBar) {
    if (isShellHeaderLayout && baseTop > 0) {
      // Mobile overlay header already reserved in base inset — only add action row.
      top = barHeight + CHROME_ACTIONS_CONTENT_CLEARANCE;
    } else {
      // Match TopActionBar: safe-area layouts use max(margin, existing safe top).
      const visualTop = honorSafe ? Math.max(topMargin, baseTop) : topMargin;
      const topNeeded = visualTop + barHeight + CHROME_ACTIONS_CONTENT_CLEARANCE;
      top = Math.max(0, topNeeded - baseTop);
    }
  }

  let bottom = 0;
  if (flags.hasPrimary && !options?.primaryInDock) {
    const aboveNav = options?.existingBottomInset ?? 0;
    const size = chromeActionsFabSize(viewport);
    const edge = chromeActionsFabEdgeMargin(viewport);
    const safeBottom = options?.safeAreaBottom ?? 0;
    // When a tab bar already reserved bottom space (includes safe-area), only add
    // FAB height + gap. Otherwise reserve FAB + margin + clearance + home indicator.
    bottom =
      aboveNav > 0
        ? size + CHROME_ACTIONS_FAB_GAP
        : edge + size + FLOATING_CONTENT_CLEARANCE + safeBottom;
  }

  return { top, right: 0, bottom, left: 0 };
}

export function mergeInsets(
  base: LayoutChromeInsets,
  extra: LayoutChromeInsets,
): LayoutChromeInsets {
  return {
    top: base.top + extra.top,
    right: base.right + extra.right,
    bottom: base.bottom + extra.bottom,
    left: base.left + extra.left,
  };
}
