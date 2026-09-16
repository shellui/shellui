import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import {
  shellui,
  getScrollMetrics,
  reduceScrollChromeVisibility,
  type LayoutChrome,
  type LayoutChromeViewport,
  type ScrollChromeState,
} from '@shellui/sdk';
import { resolveViewport } from '../../../hooks/use-viewport';
import { publishLayoutChrome } from '../floating/layoutChromeStore';
import { readShellSafeAreaPx } from '../floating/computeFloatingInsets';
import { DESKTOP_TITLEBAR_HEIGHT_PX } from './constants';

export type ScrollHideLayoutId = 'sidebar' | 'sidebar-inset' | 'app-bar' | 'app-bar-inset';

/** Host CSS var: stable mobile shell header height (safe-area + bar). */
export const SHELL_HEADER_HEIGHT_VAR = '--shellui-shell-header-height';
/**
 * Shared hide-on-scroll motion for mobile shell chrome (header + inset tray +
 * action row). Toggling this attribute on `html` applies the same translate /
 * opacity targets to every consumer so they stay in sync.
 */
export const CHROME_HIDE_ATTR = 'data-shellui-chrome-hidden';

/**
 * Pixel height of the mobile shell top bar (title row + optional safe-area).
 * Keep in sync with sidebar / app-bar header `height` styles.
 */
export function mobileShellHeaderHeightPx(options?: {
  includeSafeArea?: boolean;
  barHeightPx?: number;
}): number {
  const bar = options?.barHeightPx ?? DESKTOP_TITLEBAR_HEIGHT_PX;
  if (options?.includeSafeArea === false) return bar;
  const safe = typeof document !== 'undefined' ? readShellSafeAreaPx().top : 0;
  return bar + safe;
}

function syncShellHeaderHeightVar(heightPx: number, enabled: boolean): void {
  if (typeof document === 'undefined') return;
  if (!enabled) {
    document.documentElement.style.removeProperty(SHELL_HEADER_HEIGHT_VAR);
    return;
  }
  document.documentElement.style.setProperty(SHELL_HEADER_HEIGHT_VAR, `${heightPx}px`);
}

/** Toggle the shared chrome hide motion on <html>. */
function syncChromeHideMotion(visible: boolean, enabled: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!enabled) {
    root.removeAttribute(CHROME_HIDE_ATTR);
    return;
  }
  if (visible) root.removeAttribute(CHROME_HIDE_ATTR);
  else root.setAttribute(CHROME_HIDE_ATTR, 'true');
}

/**
 * Hide-on-scroll for shell top chrome (sidebar / app-bar mobile headers).
 * Same hysteresis as floating dock: hide on scroll down, show on scroll up,
 * near top, or near bottom.
 *
 * Publishes a **stable** top inset (header height) so iframe padding does not
 * jump when the overlay header slides away. Inset layouts keep the same stable
 * pad; their radius/tray personality is a pointer-events-none overlay that
 * hides with the bar (see `InsetMobileRadiusOverlay`).
 */
export function useScrollHideChrome(options: {
  /** When false (desktop), chrome stays visible and no layout chrome is published. */
  enabled: boolean;
  layout: ScrollHideLayoutId;
  /** Title-row height without safe-area (default 42). */
  barHeightPx?: number;
  /** When true (root shell), include safe-area-top in the header band height. */
  includeSafeArea?: boolean;
}) {
  const {
    enabled,
    layout,
    barHeightPx = DESKTOP_TITLEBAR_HEIGHT_PX,
    includeSafeArea = true,
  } = options;
  const location = useLocation();
  const [chromeVisible, setChromeVisible] = useState(true);
  const scrollStateRef = useRef<ScrollChromeState>({ visible: true, lastY: 0 });
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const readHeaderHeight = useCallback(() => {
    return mobileShellHeaderHeightPx({ barHeightPx, includeSafeArea });
  }, [barHeightPx, includeSafeArea]);

  const pushChrome = useCallback(
    (visible: boolean) => {
      if (!enabledRef.current) return;
      const viewport: LayoutChromeViewport =
        typeof window !== 'undefined' ? resolveViewport(window.innerWidth) : 'mobile';
      const headerHeight = readHeaderHeight();
      syncShellHeaderHeightVar(headerHeight, true);
      syncChromeHideMotion(visible, true);
      const snapshot: LayoutChrome = {
        layout,
        viewport,
        chromeVisible: visible,
        autoPadding: true,
        insets: {
          top: headerHeight,
          right: 0,
          bottom: 0,
          left: 0,
        },
      };
      publishLayoutChrome(snapshot);
    },
    [layout, readHeaderHeight],
  );

  const applyScrollMetrics = useCallback((scrollY: number, distanceFromBottom?: number) => {
    if (!enabledRef.current) return;
    const prevVisible = scrollStateRef.current.visible;
    const next = reduceScrollChromeVisibility(scrollStateRef.current, scrollY, {
      distanceFromBottom,
    });
    scrollStateRef.current = next;
    // Flip the shared CSS motion immediately (before React paint) so the header
    // stack and action row stay on the same animation clock.
    if (next.visible !== prevVisible) {
      syncChromeHideMotion(next.visible, true);
    }
    setChromeVisible((prev) => (prev === next.visible ? prev : next.visible));
  }, []);

  // Reset when route changes or hide-on-scroll toggles (e.g. rotate to desktop).
  useEffect(() => {
    setChromeVisible(true);
    scrollStateRef.current = { visible: true, lastY: 0 };
    if (!enabled) {
      syncShellHeaderHeightVar(0, false);
      syncChromeHideMotion(true, false);
      publishLayoutChrome(null);
      return;
    }
    pushChrome(true);
    const metrics = getScrollMetrics(document);
    if (metrics) {
      applyScrollMetrics(metrics.scrollY, metrics.distanceFromBottom);
    }
  }, [enabled, layout, location.pathname, pushChrome, applyScrollMetrics]);

  useEffect(() => {
    if (!enabled) return;
    pushChrome(chromeVisible);
  }, [chromeVisible, enabled, pushChrome]);

  useEffect(() => {
    if (!enabled) return;
    const cleanup = shellui.addMessageListener('SHELLUI_CONTENT_SCROLL', (data) => {
      const payload = data.payload as { scrollY?: number; distanceFromBottom?: number } | undefined;
      if (typeof payload?.scrollY !== 'number') return;
      applyScrollMetrics(payload.scrollY, payload.distanceFromBottom);
    });
    return cleanup;
  }, [applyScrollMetrics, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onScroll = (event: Event) => {
      const el = event.target;
      if (el instanceof Element) {
        if (
          el.closest('[data-shellui-scroll-hide-header], [data-sidebar], [data-slot="sidebar"]')
        ) {
          return;
        }
      }
      const metrics = getScrollMetrics(el);
      if (!metrics) return;
      applyScrollMetrics(metrics.scrollY, metrics.distanceFromBottom);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [applyScrollMetrics, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => {
      pushChrome(scrollStateRef.current.visible);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled, pushChrome]);

  useEffect(() => {
    return () => {
      syncShellHeaderHeightVar(0, false);
      syncChromeHideMotion(true, false);
      publishLayoutChrome(null);
    };
  }, []);

  return {
    chromeVisible: enabled ? chromeVisible : true,
    /** Stable header band height used for iframe top inset. */
    headerHeightPx: enabled ? readHeaderHeight() : 0,
  };
}
