/**
 * Central z-index scale for overlay layers.
 * Order (bottom to top): modal/drawer → toast → alert-dialog.
 * Use these constants everywhere so stacking stays consistent.
 */
export const Z_INDEX = {
  /** Sidebar trigger (above main content, below modals) */
  SIDEBAR_TRIGGER: 9999,
  /** Modal overlay and content (settings panel, etc.) */
  MODAL_OVERLAY: 10000,
  MODAL_CONTENT: 10001,
  /** Drawer overlay and content (slide-out panels; same level as modal) */
  DRAWER_OVERLAY: 10000,
  DRAWER_CONTENT: 10001,
  /** Toasts (above modals so they stay clickable when modal is open) */
  TOAST: 10100,
  /** Alert dialog overlay and content (confirmations; above toasts) */
  ALERT_DIALOG_OVERLAY: 10200,
  ALERT_DIALOG_CONTENT: 10201,
  /** Cookie consent (above everything to ensure visibility) */
  COOKIE_CONSENT_OVERLAY: 10300,
  COOKIE_CONSENT_CONTENT: 10301,
  /** Windows layout: taskbar (below windows), windows use dynamic z-index above this */
  WINDOWS_TASKBAR: 9000,
  /** Base z-index for windows; each window gets base + order */
  WINDOWS_WINDOW_BASE: 9001,
} as const;

export type ZIndexLayer = keyof typeof Z_INDEX;
