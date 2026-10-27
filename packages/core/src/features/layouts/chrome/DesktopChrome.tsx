import { useEffect } from 'react';
import { ContentDragOverlay } from './ContentDragOverlay';
import {
  syncShelluiHostAttribute,
  useIsHomeScreenPwa,
  useIsTauriClient,
  useIsTauriRuntime,
  useMacOverlayChrome,
  useMacTrafficLights,
} from './runtime';

/**
 * Global shell host chrome: document flags + a narrow traffic-light drag strip.
 * Mounted at the app root so it stays available on every page (layouts, login,
 * settings, route error boundary, empty config) — including narrow/mobile widths.
 * Full-width drag lives on layout chrome so iframe content under the titlebar
 * band stays clickable.
 *
 * Sets `data-shellui-host` to `browser` | `pwa` | `tauri` so CSS / layout can
 * distinguish Safari Home Screen PWAs (iOS 27 system status gradient) from
 * Tauri WKWebView (native-controlled chrome + CSS safe-area).
 *
 * macOS desktop: `data-shellui-mac-chrome` marks the 32px strip layouts (also in native
 * fullscreen), and `data-shellui-window-inactive` dims strip text while the window is
 * in the background, as AppKit greys the lights.
 */
export function DesktopChrome() {
  const isTauriEnv = useIsTauriClient();
  const tauriRuntime = useIsTauriRuntime();
  const homeScreenPwa = useIsHomeScreenPwa();
  const trafficLights = useMacTrafficLights();
  const macChrome = useMacOverlayChrome();

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

  useEffect(() => {
    const root = document.documentElement;
    if (!macChrome) {
      root.removeAttribute('data-shellui-mac-chrome');
      root.removeAttribute('data-shellui-window-inactive');
      return;
    }
    root.setAttribute('data-shellui-mac-chrome', '');
    const sync = () => {
      if (document.hasFocus()) root.removeAttribute('data-shellui-window-inactive');
      else root.setAttribute('data-shellui-window-inactive', '');
    };
    // Focus moving into a content iframe also blurs this window: re-check after the move.
    // `hasFocus()` stays true while a child frame holds focus.
    let timer: number | undefined;
    const syncLater = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, 0);
    };
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('blur', syncLater);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', syncLater);
      root.removeAttribute('data-shellui-mac-chrome');
      root.removeAttribute('data-shellui-window-inactive');
    };
  }, [macChrome]);

  if (!trafficLights) return null;
  return <ContentDragOverlay />;
}
