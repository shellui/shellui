import { DESKTOP_TITLEBAR_HEIGHT_PX } from './constants';

/**
 * Full-width invisible 38px strip at the top of the Tauri window.
 *
 * Uses Tauri's official `data-tauri-drag-region` (requires
 * `core:window:allow-start-dragging` in capabilities). Shell controls must sit
 * above this strip (higher z-index) so they stay clickable.
 */
export function ContentDragOverlay() {
  return (
    <div
      aria-hidden
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[45] hidden w-full md:block"
      style={{ height: DESKTOP_TITLEBAR_HEIGHT_PX }}
    />
  );
}
