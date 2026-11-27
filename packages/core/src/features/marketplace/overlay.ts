import {
  NAVIGATION_OVERLAY_VERSION,
  validateInstalledApp,
  validateNavigationOverlay,
  type AppCapability,
  type InstalledAppRecordShape,
  type NavigationOverlayShape,
  type OverlayValidationContext,
} from '@shellui/sdk';

export type InstalledAppRecord = InstalledAppRecordShape;
export type NavigationOverlay = NavigationOverlayShape<InstalledAppRecord>;
export type { AppCapability, OverlayValidationContext };

/**
 * A layout as read, with the identity version (`ETag`) it was read at. The version is not used
 * for writes until the caller commits that layout and calls `adoptVersion`.
 */
export interface LoadedNavigationOverlay {
  overlay: NavigationOverlay | null;
  etag: string | null;
}

export interface NavigationStorageAdapter {
  load(): Promise<LoadedNavigationOverlay>;
  save(overlay: NavigationOverlay): Promise<void>;
  /**
   * Remove the saved layout. `ifMatch` sends that version for this one request only and never
   * adopts it, for a retry after a conflict where this device has not shown the newer layout.
   */
  reset?(ifMatch?: string | null): Promise<void>;
  /**
   * The saved copy in identity only, never the device copy. Used after a save conflict, where a
   * stale device copy must not stand in for the newer layout.
   */
  loadRemote?(): Promise<LoadedNavigationOverlay>;
  /** The device copy for the current scope, read at once. Shown while the saved layout loads. */
  readDevice?(): NavigationOverlay | null;
  /** Send this version as `If-Match` from now on. Call it when the layout read at it is committed. */
  adoptVersion?(etag: string | null): void;
}

export function emptyNavigationOverlay(now = new Date().toISOString()): NavigationOverlay {
  return {
    version: NAVIGATION_OVERLAY_VERSION,
    installedApps: [],
    order: [],
    hiddenPaths: [],
    updatedAt: now,
  };
}

/** One stored app, or null. Same check as a runtime install and as identity-service. */
export function sanitizeInstalledApp(
  value: unknown,
  context: OverlayValidationContext,
): InstalledAppRecord | null {
  const result = validateInstalledApp(value, context);
  return result.ok ? result.app : null;
}

/**
 * Read a layout from localStorage or identity. Apps that fail the shared validator are
 * dropped. A document over 100 apps or 64 KB is refused whole.
 */
export function parseNavigationOverlay(
  raw: unknown,
  context: OverlayValidationContext,
): NavigationOverlay | null {
  const result = validateNavigationOverlay(raw, context);
  return result.ok ? result.overlay : null;
}

export function overlayHasContent(overlay: NavigationOverlay | null | undefined): boolean {
  if (!overlay) return false;
  return (
    overlay.installedApps.length > 0 || overlay.order.length > 0 || overlay.hiddenPaths.length > 0
  );
}
