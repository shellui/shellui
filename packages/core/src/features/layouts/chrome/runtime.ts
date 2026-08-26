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

/** Overlay titlebar chrome: Tauri on macOS, desktop (non-mobile) viewport. */
export function useMacOverlayChrome(): boolean {
  const trafficLights = useMacTrafficLights();
  const isMobile = useIsMobile();
  return trafficLights && !isMobile;
}

/**
 * Native macOS traffic lights are on the window (Tauri macOS), including
 * narrow / mobile layouts where overlay chrome is otherwise disabled.
 */
export function useMacTrafficLights(): boolean {
  const tauri = useIsTauriClient();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(isMacOSDesktop());
  }, []);

  return tauri && isMac;
}
