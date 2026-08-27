import { LOADING_OVERLAY_DURATION_MS } from '../../constants/loading';
import { DYNAMIC_DRAWER_PENDING_PX } from './overlaySize';

/**
 * Full-bleed loading bar for dynamic drawers while waiting for the first size report.
 * Matches drawer pending chrome height so the strip is the animation.
 */
export function OverlayDrawerPendingBar() {
  return (
    <div
      className="absolute inset-0 z-20 overflow-hidden bg-muted/30"
      style={{ minHeight: DYNAMIC_DRAWER_PENDING_PX }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="h-full w-0 bg-muted-foreground/40"
        style={{
          animation: `loading-bar-slide ${LOADING_OVERLAY_DURATION_MS}ms linear infinite`,
        }}
        aria-hidden
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
