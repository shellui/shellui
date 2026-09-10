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

function buildChrome(
  viewport: LayoutChromeViewport,
  chromeVisible: boolean,
  autoPadding = true,
): LayoutChrome {
  const safeArea =
    typeof document !== 'undefined'
      ? readShellSafeAreaPx()
      : { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    layout: 'floating',
    viewport,
    chromeVisible,
    autoPadding,
    // Always reserve chrome-sized insets so iframe padding does not jump when
    // floating chrome hides on scroll (visibility is separate from insets).
    insets: computeFloatingInsets({ viewport, chromeVisible: true, safeArea }),
  };
}

/**
 * Owns floating chrome visibility (hide-on-scroll on phone/tablet only),
 * publishes layoutChrome to iframes, and listens for scroll from iframe / shell pages.
 * Desktop sidebar stays visible. Chrome reappears near top and bottom of content.
 */
export function useFloatingChrome(viewport: LayoutChromeViewport) {
  const location = useLocation();
  const [chromeVisible, setChromeVisible] = useState(true);
  const scrollStateRef = useRef<ScrollChromeState>({ visible: true, lastY: 0 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const hideOnScroll = viewport !== 'desktop';

  const pushChrome = useCallback((visible: boolean, vp: LayoutChromeViewport) => {
    const chrome = buildChrome(vp, visible);
    publishLayoutChrome(chrome);
  }, []);

  const applyScrollMetrics = useCallback((scrollY: number, distanceFromBottom?: number) => {
    if (viewportRef.current === 'desktop') return;
    const next = reduceScrollChromeVisibility(scrollStateRef.current, scrollY, {
      distanceFromBottom,
    });
    scrollStateRef.current = next;
    setChromeVisible((prev) => (prev === next.visible ? prev : next.visible));
  }, []);

  // Reset hide-on-scroll when viewport tier or shell route changes.
  useEffect(() => {
    setChromeVisible(true);
    scrollStateRef.current = { visible: true, lastY: 0 };
    pushChrome(true, viewport);
  }, [viewport, location.pathname, pushChrome]);

  useEffect(() => {
    // Desktop never hides; keep published insets for a visible sidebar.
    const visible = viewport === 'desktop' ? true : chromeVisible;
    pushChrome(visible, viewport);
  }, [chromeVisible, viewport, pushChrome]);

  useEffect(() => {
    const onResize = () => {
      const visible = viewportRef.current === 'desktop' ? true : scrollStateRef.current.visible;
      pushChrome(visible, viewportRef.current);
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
      safeArea,
    });
  }, [viewport]);

  return { chromeVisible: effectiveVisible, setChromeVisible, insets };
}
