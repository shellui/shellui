import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

function readIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * True below the `md` breakpoint (width &lt; 768).
 * Listens to matchMedia **and** resize/orientationchange — iOS often updates
 * `innerWidth` on resize before (or without) a reliable matchMedia `change`.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(readIsMobile);

  React.useEffect(() => {
    const sync = () => setIsMobile(readIsMobile());
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    sync();
    return () => {
      mql.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  return isMobile;
}
