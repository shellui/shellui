import * as React from 'react';

/** Matches Tailwind `md` (tablet and up). */
export const VIEWPORT_MOBILE_MAX = 767;
/** Matches Tailwind `lg` (desktop and up). */
export const VIEWPORT_TABLET_MAX = 1023;

export type ShellViewport = 'mobile' | 'tablet' | 'desktop';

export function resolveViewport(width: number): ShellViewport {
  if (width <= VIEWPORT_MOBILE_MAX) return 'mobile';
  if (width <= VIEWPORT_TABLET_MAX) return 'tablet';
  return 'desktop';
}

/** Reactive viewport tier: mobile (&lt;768), tablet (768–1023), desktop (≥1024). */
export function useViewport(): ShellViewport {
  const [viewport, setViewport] = React.useState<ShellViewport>(() =>
    typeof window !== 'undefined' ? resolveViewport(window.innerWidth) : 'desktop',
  );

  React.useEffect(() => {
    const sync = () => setViewport(resolveViewport(window.innerWidth));
    const mobileMql = window.matchMedia(`(max-width: ${VIEWPORT_MOBILE_MAX}px)`);
    const tabletMql = window.matchMedia(
      `(min-width: ${VIEWPORT_MOBILE_MAX + 1}px) and (max-width: ${VIEWPORT_TABLET_MAX}px)`,
    );
    mobileMql.addEventListener('change', sync);
    tabletMql.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    sync();
    return () => {
      mobileMql.removeEventListener('change', sync);
      tabletMql.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return viewport;
}
