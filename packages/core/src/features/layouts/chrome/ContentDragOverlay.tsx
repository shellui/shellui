import { DESKTOP_TITLEBAR_HEIGHT_PX, MAC_LIGHTS_SAFE_PX } from './constants';

/**
 * Narrow drag strip over the lights safe area only (0 to 80 x 0 to 32).
 *
 * A full-width overlay used to sit on top of iframes and steal clicks from
 * embedded content. Dragging the window still works from layout chrome
 * (app bar, sidebar header, admin header, windows strip) and from this
 * safe area. Interactive iframe content to the right stays clickable.
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
        width: MAC_LIGHTS_SAFE_PX,
      }}
    />
  );
}
