/**
 * Central z-index scale for overlay layers.
 * Order (bottom to top): modal → toast → alert-dialog.
 * Use these constants everywhere so stacking stays consistent.
 */
export const Z_INDEX = {
  /** Sidebar trigger (above main content, below modals) */
  SIDEBAR_TRIGGER: 9999,
  /** Modal overlay and content (settings panel, etc.) */
  MODAL_OVERLAY: 10000,
  MODAL_CONTENT: 10001,
  /** Toasts (above modals so they stay clickable when modal is open) */
  TOAST: 10100,
  /** Alert dialog overlay and content (confirmations; above toasts) */
  ALERT_DIALOG_OVERLAY: 10200,
  ALERT_DIALOG_CONTENT: 10201,
} as const;

export type ZIndexLayer = keyof typeof Z_INDEX;
