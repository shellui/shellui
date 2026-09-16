import { useEffect } from 'react';
import { ContentDragOverlay } from './ContentDragOverlay';
import {
  syncShelluiHostAttribute,
  useIsHomeScreenPwa,
  useIsTauriClient,
  useIsTauriRuntime,
  useMacTrafficLights,
} from './runtime';

/**
 * Global shell host chrome: document flags + the 42px Tauri drag strip.
 * Mounted at the app root so it stays available on every page (layouts, login,
 * settings, route error boundary, empty config) — including narrow/mobile widths.
 *
 * Sets `data-shellui-host` to `browser` | `pwa` | `tauri` so CSS / layout can
 * distinguish Safari Home Screen PWAs (iOS 27 system status gradient) from
 * Tauri WKWebView (native-controlled chrome + CSS safe-area).
 */
export function DesktopChrome() {
  const isTauriEnv = useIsTauriClient();
  const tauriRuntime = useIsTauriRuntime();
  const homeScreenPwa = useIsHomeScreenPwa();
  const trafficLights = useMacTrafficLights();

  useEffect(() => {
    const root = document.documentElement;
    syncShelluiHostAttribute();
    if (trafficLights) root.setAttribute('data-shellui-overlay-chrome', '');
    else root.removeAttribute('data-shellui-overlay-chrome');
    if (isTauriEnv) root.setAttribute('data-shellui-tauri', '');
    else root.removeAttribute('data-shellui-tauri');
    return () => {
      root.removeAttribute('data-shellui-overlay-chrome');
      root.removeAttribute('data-shellui-tauri');
      root.removeAttribute('data-shellui-host');
    };
  }, [trafficLights, isTauriEnv, tauriRuntime, homeScreenPwa]);

  if (!trafficLights) return null;
  return <ContentDragOverlay />;
}
