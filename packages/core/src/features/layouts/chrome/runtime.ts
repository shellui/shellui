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

type TauriInternals = {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  transformCallback: (callback: (data: unknown) => void, once: boolean) => number;
  unregisterCallback?: (id: number) => void;
  metadata?: { currentWindow?: { label?: string } };
};

function getTauriInternals(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__ ?? null;
}

/**
 * True only inside a real Tauri webview (`__TAURI__` / `__TAURI_INTERNALS__`).
 * Unlike `isTauri()`, this ignores the CLI `--target tauri` build flag
 * (`__SHELLUI_TAURI__`) so a browser tab opened against the same URL does not
 * get traffic-light padding.
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return !!(w.__TAURI__ ?? w.__TAURI_INTERNALS__);
}

function currentWindowLabel(internals: TauriInternals): string {
  return internals.metadata?.currentWindow?.label || 'main';
}

/** Native macOS / OS fullscreen via Tauri window plugin (no npm import required). */
async function readTauriFullscreen(): Promise<boolean> {
  const internals = getTauriInternals();
  if (!internals?.invoke) return false;
  try {
    return Boolean(
      await internals.invoke('plugin:window|is_fullscreen', {
        label: currentWindowLabel(internals),
      }),
    );
  } catch {
    return false;
  }
}

/**
 * Listen for window resize (includes fullscreen transitions on macOS).
 * Uses Tauri event IPC when available; falls back to DOM `resize`.
 */
async function listenTauriWindowResized(handler: () => void): Promise<() => void> {
  const internals = getTauriInternals();
  if (internals?.invoke && internals.transformCallback) {
    const label = currentWindowLabel(internals);
    const callbackId = internals.transformCallback(() => {
      handler();
    }, false);
    try {
      const eventId = (await internals.invoke('plugin:event|listen', {
        event: 'tauri://resize',
        target: { kind: 'Window', label },
        handler: callbackId,
      })) as number;
      return () => {
        internals.unregisterCallback?.(callbackId);
        void internals
          .invoke('plugin:event|unlisten', { event: 'tauri://resize', eventId })
          .catch(() => undefined);
      };
    } catch {
      internals.unregisterCallback?.(callbackId);
    }
  }

  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
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

/** Live Tauri webview (not merely a tauri-targeted web build). */
export function useIsTauriRuntime(): boolean {
  const [value, setValue] = useState(() => isTauriRuntime());

  useEffect(() => {
    setValue(isTauriRuntime());
    // __TAURI_INTERNALS__ can appear slightly after first paint in dev.
    const timer = window.setTimeout(() => setValue(isTauriRuntime()), 200);
    return () => window.clearTimeout(timer);
  }, []);

  return value;
}

/**
 * Native window fullscreen (Tauri `is_fullscreen` + resize listener).
 * Resize can fire before macOS updates fullscreen state, so we re-check after a short delay.
 * @see https://v2.tauri.app/reference/javascript/api/namespacewindow/#isfullscreen
 */
export function useIsTauriFullscreen(): boolean {
  const tauriRuntime = useIsTauriRuntime();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!tauriRuntime) {
      setFullscreen(false);
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let debounceTimer: number | undefined;

    const sync = async () => {
      const next = await readTauriFullscreen();
      if (!cancelled) setFullscreen(next);
    };

    void (async () => {
      await sync();
      unlisten = await listenTauriWindowResized(() => {
        void sync();
        window.clearTimeout(debounceTimer);
        // macOS often flips isFullscreen after the resize notification.
        debounceTimer = window.setTimeout(() => {
          void sync();
        }, 400);
      });
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      unlisten?.();
    };
  }, [tauriRuntime]);

  return fullscreen;
}

/**
 * macOS Tauri desktop chrome (history buttons, collapsed titlebar, drag regions).
 * Stays on in native fullscreen — only the traffic-light *inset* goes away there.
 */
export function useMacOverlayChrome(): boolean {
  const tauriRuntime = useIsTauriRuntime();
  const isMobile = useIsMobile();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(isMacOSDesktop());
  }, []);

  return tauriRuntime && isMac && !isMobile;
}

/**
 * Native macOS traffic lights that need chrome inset: live Tauri webview on
 * macOS, windowed (not native fullscreen — lights are hidden there).
 */
export function useMacTrafficLights(): boolean {
  const overlay = useMacOverlayChrome();
  const fullscreen = useIsTauriFullscreen();
  return overlay && !fullscreen;
}
