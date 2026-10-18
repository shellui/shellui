import { DESKTOP_TITLEBAR_HEIGHT_PX, MAC_TRAFFIC_LIGHTS_WIDTH_PX } from './constants';

/**
 * Narrow left strip over the traffic-light band only.
 *
 * A full-width overlay used to sit on top of iframes and steal clicks from
 * embedded content. Dragging the window still works from layout chrome
 * (app bar, sidebar header, admin header, windows titlebar) and from this
 * empty traffic-light spacer. Interactive iframe content to the right stays
 * clickable.
 *
 * Requires `core:window:allow-start-dragging` in Tauri capabilities.
 */
export function ContentDragOverlay() {
  return (
    <div
      aria-hidden
      data-tauri-drag-region
      className="fixed top-0 left-0 z-[45]"
      style={{
        height: DESKTOP_TITLEBAR_HEIGHT_PX,
        width: MAC_TRAFFIC_LIGHTS_WIDTH_PX,
      }}
    />
  );
}
