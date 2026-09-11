import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import {
  shellui,
  getScrollMetrics,
  reduceScrollChromeVisibility,
  type LayoutChrome,
  type LayoutChromeInsets,
  type LayoutChromeViewport,
  type ScrollChromeState,
} from '@shellui/sdk';
import { computeFloatingInsets, readShellSafeAreaPx } from './computeFloatingInsets';
import { publishLayoutChrome } from './layoutChromeStore';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'shellui:floating-sidebar:collapsed';
/** Scroll Y / bottom distance under which an edge counts as “at end” (no fade). */
const SCROLL_EDGE_PX = 8;

export type FloatingScrollEdges = {
  atTop: boolean;
  atBottom: boolean;
};

const INITIAL_SCROLL_EDGES: FloatingScrollEdges = { atTop: true, atBottom: true };

function edgesFromMetrics(scrollY: number, distanceFromBottom?: number): FloatingScrollEdges {
  const atTop = scrollY <= SCROLL_EDGE_PX;
  const atBottom =
    typeof distanceFromBottom === 'number' ? distanceFromBottom <= SCROLL_EDGE_PX : atTop;
  return { atTop, atBottom };
}

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

function buildChrome(
  viewport: LayoutChromeViewport,
  chromeVisible: boolean,
  sidebarCollapsed: boolean,
  autoPadding = true,
): LayoutChrome {
  const safeArea =
    typeof document !== 'undefined'
      ? readShellSafeAreaPx()
      : { top: 0, right: 0, bottom: 0, left: 0 };
  const desktopCollapsed = viewport === 'desktop' && sidebarCollapsed;
  return {
    layout: 'floating',
    viewport,
    chromeVisible: viewport === 'desktop' ? !desktopCollapsed : chromeVisible,
    autoPadding,
    // Phone/tablet: keep tab-bar-sized insets even when chrome hides on scroll
    // so padding does not jump. Desktop: insets follow sidebar collapsed state.
    insets: computeFloatingInsets({
      viewport,
      chromeVisible: true,
      sidebarCollapsed: desktopCollapsed,
      safeArea,
    }),
  };
}

/**
 * Owns floating chrome visibility (hide-on-scroll on phone/tablet),
 * desktop sidebar collapse, publishes layoutChrome to iframes.
 */
export function useFloatingChrome(viewport: LayoutChromeViewport) {
  const location = useLocation();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [scrollEdges, setScrollEdges] = useState<FloatingScrollEdges>(INITIAL_SCROLL_EDGES);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(readSidebarCollapsed);
  const scrollStateRef = useRef<ScrollChromeState>({ visible: true, lastY: 0 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  sidebarCollapsedRef.current = sidebarCollapsed;
  const hideOnScroll = viewport !== 'desktop';

  const pushChrome = useCallback(
    (visible: boolean, vp: LayoutChromeViewport, collapsed: boolean) => {
      publishLayoutChrome(buildChrome(vp, visible, collapsed));
    },
    [],
  );

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    writeSidebarCollapsed(collapsed);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsedRef.current);
  }, [setSidebarCollapsed]);

  const applyScrollMetrics = useCallback((scrollY: number, distanceFromBottom?: number) => {
    if (viewportRef.current === 'desktop') return;

    const edges = edgesFromMetrics(scrollY, distanceFromBottom);
    setScrollEdges((prev) =>
      prev.atTop === edges.atTop && prev.atBottom === edges.atBottom ? prev : edges,
    );

    const next = reduceScrollChromeVisibility(scrollStateRef.current, scrollY, {
      distanceFromBottom,
    });
    scrollStateRef.current = next;
    setChromeVisible((prev) => (prev === next.visible ? prev : next.visible));
  }, []);

  // Reset hide-on-scroll when viewport tier or shell route changes.
  useEffect(() => {
    setChromeVisible(true);
    setScrollEdges(INITIAL_SCROLL_EDGES);
    scrollStateRef.current = { visible: true, lastY: 0 };
    pushChrome(true, viewport, sidebarCollapsedRef.current);
    // Shell-owned pages: sample document scroller (iframes report via message).
    const metrics = getScrollMetrics(document);
    if (metrics) {
      applyScrollMetrics(metrics.scrollY, metrics.distanceFromBottom);
    }
  }, [viewport, location.pathname, pushChrome, applyScrollMetrics]);

  useEffect(() => {
    const visible = viewport === 'desktop' ? true : chromeVisible;
    pushChrome(visible, viewport, sidebarCollapsed);
  }, [chromeVisible, viewport, sidebarCollapsed, pushChrome]);

  useEffect(() => {
    const onResize = () => {
      const visible = viewportRef.current === 'desktop' ? true : scrollStateRef.current.visible;
      pushChrome(visible, viewportRef.current, sidebarCollapsedRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pushChrome]);

  useEffect(() => {
    if (!hideOnScroll) return;
    const cleanup = shellui.addMessageListener('SHELLUI_CONTENT_SCROLL', (data) => {
      const payload = data.payload as
        | { scrollY?: number; direction?: 'up' | 'down' | 'none'; distanceFromBottom?: number }
        | undefined;
      if (typeof payload?.scrollY !== 'number') return;
      applyScrollMetrics(payload.scrollY, payload.distanceFromBottom);
    });
    return cleanup;
  }, [applyScrollMetrics, hideOnScroll]);

  useEffect(() => {
    if (!hideOnScroll) return;
    const onScroll = (event: Event) => {
      const el = event.target;
      if (el instanceof Element) {
        if (
          el.closest(
            '[data-shellui-floating-tabbar], [data-shellui-floating-sidebar], [data-shellui-floating-fade]',
          )
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
  }, [applyScrollMetrics, hideOnScroll]);

  useEffect(() => {
    return () => {
      publishLayoutChrome(null);
    };
  }, []);

  const effectiveVisible = viewport === 'desktop' ? true : chromeVisible;

  const insets: LayoutChromeInsets = useMemo(() => {
    const safeArea =
      typeof document !== 'undefined'
        ? readShellSafeAreaPx()
        : { top: 0, right: 0, bottom: 0, left: 0 };
    return computeFloatingInsets({
      viewport,
      chromeVisible: true,
      sidebarCollapsed: viewport === 'desktop' && sidebarCollapsed,
      safeArea,
    });
  }, [viewport, sidebarCollapsed]);

  return {
    chromeVisible: effectiveVisible,
    setChromeVisible,
    sidebarCollapsed: viewport === 'desktop' ? sidebarCollapsed : false,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    scrollEdges,
    insets,
  };
}
