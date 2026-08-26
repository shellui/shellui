import { useEffect } from 'react';
import { ContentDragOverlay } from './ContentDragOverlay';
import { useIsTauriClient, useMacTrafficLights } from './runtime';

/**
 * Global Tauri desktop chrome: document flags + the 38px top drag strip.
 * Mounted at the app root so it stays available on every page (layouts, login,
 * settings, route error boundary, empty config) — including narrow/mobile widths.
 */
export function DesktopChrome() {
  const isTauriEnv = useIsTauriClient();
  const trafficLights = useMacTrafficLights();

  useEffect(() => {
    const root = document.documentElement;
    if (trafficLights) root.setAttribute('data-shellui-overlay-chrome', '');
    else root.removeAttribute('data-shellui-overlay-chrome');
    if (isTauriEnv) root.setAttribute('data-shellui-tauri', '');
    else root.removeAttribute('data-shellui-tauri');
    return () => {
      root.removeAttribute('data-shellui-overlay-chrome');
      root.removeAttribute('data-shellui-tauri');
    };
  }, [trafficLights, isTauriEnv]);

  if (!trafficLights) return null;
  return <ContentDragOverlay />;
}
