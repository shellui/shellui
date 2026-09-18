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
 *
 * Use this for native-specific UI (macOS traffic lights, iOS App Store WKWebView
 * adjustments). Prefer over `isTauri()` whenever behavior must differ between a
 * live native shell and a browser tab of a tauri-targeted build.
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return !!(w.__TAURI__ ?? w.__TAURI_INTERNALS__);
}

/**
 * Installed web app display mode (Safari "Add to Home Screen", Android TWA, etc.).
 * Includes `navigator.standalone` for older iOS. Does not imply Tauri.
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/**
 * Safari / Android Home Screen PWA — not a Tauri native WKWebView.
 *
 * iOS 26/27 applies Liquid Glass status-bar sampling / gradients only to these
 * standalone web apps. Tauri iOS hosts the same React UI in a native webview and
 * does not get that Home Screen PWA system treatment — gate PWA-only chrome
 * workarounds with this helper, not with `isTauri()` alone.
 */
export function isHomeScreenPwa(): boolean {
  return isStandaloneDisplayMode() && !isTauriRuntime();
}

/** How the shell is hosted: browser tab, installed PWA, or Tauri native. */
export type ShelluiHostKind = 'browser' | 'pwa' | 'tauri';

export function getShelluiHostKind(): ShelluiHostKind {
  if (isTauriRuntime()) return 'tauri';
  if (isStandaloneDisplayMode()) return 'pwa';
  return 'browser';
}

/** Sync `html[data-shellui-host]` for CSS / debugging. */
export function syncShelluiHostAttribute(): ShelluiHostKind {
  if (typeof document === 'undefined') return 'browser';
  const kind = getShelluiHostKind();
  document.documentElement.setAttribute('data-shellui-host', kind);
  return kind;
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

/** Home Screen / installed PWA (excludes Tauri native). */
export function useIsHomeScreenPwa(): boolean {
  const [value, setValue] = useState(() => isHomeScreenPwa());

  useEffect(() => {
    const sync = () => setValue(isHomeScreenPwa());
    sync();
    // Late __TAURI__ injection can flip PWA → tauri in the same document.
    const timer = window.setTimeout(sync, 200);
    let mql: MediaQueryList | undefined;
    try {
      mql = window.matchMedia('(display-mode: standalone)');
      mql.addEventListener('change', sync);
    } catch {
      /* ignore */
    }
    return () => {
      window.clearTimeout(timer);
      mql?.removeEventListener('change', sync);
    };
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
 * Desktop viewport only — narrow/mobile layouts use the sheet / top header instead.
 * Stays on in native fullscreen; only the traffic-light *inset* goes away there.
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
 * Applies at any viewport width (narrow window / mobile layout included).
 */
export function useMacTrafficLights(): boolean {
  const tauriRuntime = useIsTauriRuntime();
  const fullscreen = useIsTauriFullscreen();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(isMacOSDesktop());
  }, []);

  return tauriRuntime && isMac && !fullscreen;
}
