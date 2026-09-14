import type { LayoutChromeInsets } from '@shellui/sdk';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_CONTENT_CLEARANCE,
} from '../layouts/floating/computeFloatingInsets';
import type { FrameChromeActions } from './chromeActionsStore';

/** Top floating action bar height (back + title + trailing). */
export const CHROME_ACTIONS_TOP_BAR_HEIGHT = 44;
/** Bottom primary FAB diameter. */
export const CHROME_ACTIONS_FAB_SIZE = 56;
/** Gap between FAB and floating tab bar / screen edge. */
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
  },
): LayoutChromeInsets {
  const top =
    flags.hasTop && !options?.topInTitleBar
      ? FLOATING_CHROME_MARGIN + CHROME_ACTIONS_TOP_BAR_HEIGHT + FLOATING_CONTENT_CLEARANCE
      : 0;

  let bottom = 0;
  if (flags.hasPrimary) {
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
