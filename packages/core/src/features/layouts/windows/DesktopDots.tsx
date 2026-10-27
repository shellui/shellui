import { useEffect, useRef } from 'react';
import { mountDeskDots, type DeskDotsHandle } from './deskDots';

/** Window attributes the field watches to pause itself. */
const WATCHED_ATTRS = ['data-maximized', 'data-focused', 'data-interacting'];

/** True when a focused window fills the desktop or any window is dragged or resized. */
export function isDesktopCovered(root: ParentNode): boolean {
  return Boolean(
    root.querySelector(
      '[data-shellui-window][data-focused="true"][data-maximized="true"], [data-shellui-window][data-interacting="true"]',
    ),
  );
}

/**
 * Calm dot field behind the windows. Canvas while motion is allowed; a static CSS
 * grid (`[data-shellui-desk-dots]::before`) under `prefers-reduced-motion`.
 * Pauses when the tab is hidden, while the desktop is covered, and during drags.
 */
export function DesktopDots({ watchRoot }: { watchRoot: React.RefObject<HTMLElement | null> }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let dots: DeskDotsHandle | null = null;
    let observer: MutationObserver | null = null;

    const syncPause = () => {
      const root = watchRoot.current;
      dots?.pause(root ? isDesktopCovered(root) : false);
    };

    const start = () => {
      if (dots || reduce?.matches) return;
      dots = mountDeskDots(host);
      const root = watchRoot.current;
      if (root) {
        observer = new MutationObserver(syncPause);
        observer.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: WATCHED_ATTRS,
        });
      }
      syncPause();
    };

    const stop = () => {
      observer?.disconnect();
      observer = null;
      dots?.destroy();
      dots = null;
    };

    const onReduceChange = () => (reduce?.matches ? stop() : start());
    reduce?.addEventListener?.('change', onReduceChange);
    start();
    return () => {
      reduce?.removeEventListener?.('change', onReduceChange);
      stop();
    };
  }, [watchRoot]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      data-shellui-desk-dots=""
      className="pointer-events-none absolute inset-0"
    />
  );
}
