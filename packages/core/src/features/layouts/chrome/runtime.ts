import { useEffect, useState } from 'react';
import { isTauri } from '../../../service-worker/register';
import { useIsMobile } from '../../../hooks/use-mobile';

/** True for macOS desktop (not iOS/iPad, which can report MacIntel). */
export function isMacOSDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform || '';
  const touchIpad = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return platform.startsWith('Mac') && !touchIpad;
}

export function useIsTauriClient(): boolean {
  const [value, setValue] = useState(() => isTauri());

  useEffect(() => {
    setValue(isTauri());
    const timer = window.setTimeout(() => setValue(isTauri()), 200);
    return () => window.clearTimeout(timer);
  }, []);

  return value;
}

/** Overlay titlebar + traffic lights: Tauri on macOS, desktop viewport. */
export function useMacOverlayChrome(): boolean {
  const tauri = useIsTauriClient();
  const isMobile = useIsMobile();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(isMacOSDesktop());
  }, []);

  return tauri && isMac && !isMobile;
}
