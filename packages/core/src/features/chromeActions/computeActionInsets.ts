import type { LayoutChromeInsets } from '@shellui/sdk';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_CONTENT_CLEARANCE,
} from '../layouts/floating/computeFloatingInsets';
import type { FrameChromeActions } from './chromeActionsStore';

/** Top floating action row height (matches secondary h-8 / text-xs controls). */
export const CHROME_ACTIONS_TOP_BAR_HEIGHT = 32;
/**
 * Breathing room above the top action row (below safe-area).
 * Slightly roomier than general floating chrome margin so controls aren’t cramped.
 */
export const CHROME_ACTIONS_TOP_MARGIN = 20;
/**
 * Extra scrim height below the action row. With `from-80%`, this ~20% band
 * fades background → transparent so content eases in under the chrome.
 */
export const CHROME_ACTIONS_TOP_SCRIM_FADE = 16;
/** Bottom primary action button size (default shadcn icon). */
export const CHROME_ACTIONS_FAB_SIZE = 40;
/** Floating phone/tablet FAB — matches `FLOATING_TAB_BAR_HEIGHT`. */
export const CHROME_ACTIONS_FAB_SIZE_FLOATING = 56;
/** Gap between primary FAB and floating tab bar (corner FAB uses FLOATING_CHROME_MARGIN). */
export const CHROME_ACTIONS_FAB_GAP = 12;

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
     * Primary FAB shares the floating bottom band (corner, beside the nav) —
     * no extra bottom inset beyond the dock height.
     */
    primaryInDock?: boolean;
  },
): LayoutChromeInsets {
  const top =
    flags.hasTop && !options?.topInTitleBar
      ? CHROME_ACTIONS_TOP_MARGIN + CHROME_ACTIONS_TOP_BAR_HEIGHT + FLOATING_CONTENT_CLEARANCE
      : 0;

  let bottom = 0;
  if (flags.hasPrimary && !options?.primaryInDock) {
    const aboveNav = options?.existingBottomInset ?? 0;
    // When a tab bar already reserved bottom space, only add FAB height + gap.
    // Otherwise reserve FAB + margin + clearance from the screen edge.
    bottom =
      aboveNav > 0
        ? CHROME_ACTIONS_FAB_SIZE + CHROME_ACTIONS_FAB_GAP
        : FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_SIZE + FLOATING_CONTENT_CLEARANCE;
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
