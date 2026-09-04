import type { NavigationItem } from '../features/config/types';
import { isHashRouterNavItem, getHashPathFromUrl } from '../features/layouts/utils';
import {
  addIframe,
  removeIframe,
  shellui,
  getLogger,
  type ShellUIUrlPayload,
  type ShellUIMessage,
} from '@shellui/sdk';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LOADING_OVERLAY_DURATION_MS } from '../constants/loading';
import { LoadingOverlay } from './LoadingOverlay';
import { IFRAME_FOREIGN_ATTR } from '../features/layouts/chrome/constants';

const logger = getLogger('shellcore');

function normalizeShellPath(pathname: string, search: string): string {
  const pathnamePart = pathname.replace(/\/+$/, '') || '/';
  return pathnamePart + search;
}

/** Reject protocol-relative and scheme-based paths so navigate() stays on-shell. */
function isSafeShellPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  // e.g. "/javascript:..." should never be treated as a router path we trust blindly
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false;
  return true;
}

function isSafeIframeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSameOriginAsNavItem(targetUrl: string, navItem: NavigationItem): boolean {
  try {
    const target = new URL(
      targetUrl,
      typeof window !== 'undefined' ? window.location.href : undefined,
    );
    const allowed = new URL(
      navItem.url,
      typeof window !== 'undefined' ? window.location.href : undefined,
    );
    return target.origin === allowed.origin;
  } catch {
    return false;
  }
}

/** Apply a URL inside the iframe without adding a joint session-history entry. */
function replaceIframeLocation(iframe: HTMLIFrameElement, targetUrl: string): boolean {
  if (!isSafeIframeUrl(targetUrl)) {
    logger.warn('ContentView: refused unsafe iframe URL', targetUrl);
    return false;
  }
  try {
    iframe.contentWindow?.location.replace(targetUrl);
    return true;
  } catch {
    return false;
  }
}

interface ContentViewProps {
  url: string;
  pathPrefix: string;
  ignoreMessages?: boolean;
  navItem: NavigationItem;
}

export const ContentView = ({
  url,
  pathPrefix,
  ignoreMessages = false,
  navItem,
}: ContentViewProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cancelRevealRef = useRef<(() => void) | null>(null);
  const mountTimeRef = useRef(Date.now());
  /** Shell path last reported by the iframe — skip driving iframe when we caused the location change. */
  const lastShellPathFromIframeRef = useRef<string | null>(null);
  const skipInitialShellSyncRef = useRef(true);
  const prevNavPathRef = useRef(navItem?.path ?? '');

  const [isLoading, setIsLoading] = useState(() => {
    // Skip overlay when same app URL was just loaded (e.g. switching App ↔ Root with same url)
    if (!ignoreMessages) return false;
    return true;
  });

  const [iframeUrl, setIframeUrl] = useState(url);
  /** Bumped only when the iframe element must remount (nav item / app change). */
  const [frameGeneration, setFrameGeneration] = useState(0);

  const MIN_LOADING_MS = 80; // Don't reveal before this, reduces blink from theme/layout paint

  useLayoutEffect(() => {
    if (!iframeRef.current) {
      return;
    }
    const iframeId = addIframe(iframeRef.current);
    return () => {
      removeIframe(iframeId);
    };
  }, [iframeUrl, navItem?.path ?? '', frameGeneration]);

  // Drive iframe when the shell location changes from outside the iframe
  // (nav item click, router back/forward). Prefer location.replace so we do not
  // pollute joint session history (same-origin iframe src changes would).
  useLayoutEffect(() => {
    if (ignoreMessages) return;

    const currentShellPath = normalizeShellPath(location.pathname, location.search);
    const navPath = navItem?.path ?? '';
    const navItemChanged = prevNavPathRef.current !== navPath;
    prevNavPathRef.current = navPath;

    if (skipInitialShellSyncRef.current) {
      skipInitialShellSyncRef.current = false;
      lastShellPathFromIframeRef.current = currentShellPath;
      if (isSafeIframeUrl(url) && isSameOriginAsNavItem(url, navItem)) {
        setIframeUrl(url);
      }
      return;
    }

    if (lastShellPathFromIframeRef.current === currentShellPath && !navItemChanged) {
      return;
    }

    lastShellPathFromIframeRef.current = currentShellPath;
    mountTimeRef.current = Date.now();
    cancelRevealRef.current?.();

    if (navItemChanged) {
      if (!isSafeIframeUrl(url) || !isSameOriginAsNavItem(url, navItem)) {
        logger.warn('ContentView: refused remount to unsafe or cross-origin URL', url);
        return;
      }
      setIsLoading(true);
      setIframeUrl(url);
      setFrameGeneration((generation) => generation + 1);
      return;
    }

    const iframe = iframeRef.current;
    if (iframe && isSameOriginAsNavItem(url, navItem) && replaceIframeLocation(iframe, url)) {
      // Do not update the src prop — React would re-navigate the iframe and can
      // push a joint session-history entry, wiping intermediate shell routes.
      return;
    }

    if (!isSafeIframeUrl(url) || !isSameOriginAsNavItem(url, navItem)) {
      logger.warn('ContentView: refused remount to unsafe or cross-origin URL', url);
      return;
    }

    setIsLoading(true);
    setIframeUrl(url);
    setFrameGeneration((generation) => generation + 1);
  }, [location.pathname, location.search, url, ignoreMessages, navItem]);

  // Sync parent URL when iframe notifies us of a change
  useEffect(() => {
    const cleanup = shellui.addMessageListener(
      'SHELLUI_URL_CHANGED',
      (data: ShellUIMessage, event: MessageEvent) => {
        if (ignoreMessages) {
          return;
        }

        if (isLoading) return;

        // Ignore URL CHANGE from other than ContentView iframe
        if (event.source !== iframeRef.current?.contentWindow) {
          return;
        }

        const { pathname, search, hash } = data.payload as ShellUIUrlPayload;
        // Shell URL is always path + search only (no hash) so it's transparent whether the sub-app uses hash routing or not
        let pathSegment: string;
        if (isHashRouterNavItem(navItem) && hash) {
          // Hash-router app: use path relative to nav item's hash (e.g. nav #/themes, iframe #/themes → segment ''; iframe #/themes/foo → segment 'foo')
          const iframeHashPath = hash.replace(/^#\/?/, '').replace(/\/+$/, '') || '';
          const navHashPath = getHashPathFromUrl(navItem.url).replace(/^\/+|\/+$/g, '');
          const relative = navHashPath
            ? iframeHashPath === navHashPath || iframeHashPath.startsWith(`${navHashPath}/`)
              ? iframeHashPath.slice(navHashPath.length).replace(/^\//, '')
              : iframeHashPath
            : iframeHashPath;
          pathSegment = relative;
        } else {
          // Non-hash app: route is pathname
          let cleanPathname = pathname.startsWith(navItem.url)
            ? pathname.slice(navItem.url.length)
            : pathname;
          cleanPathname = cleanPathname.startsWith('/') ? cleanPathname.slice(1) : cleanPathname;
          pathSegment = cleanPathname.replace(/\/+$/, '');
        }
        // Root (pathPrefix '' or '/') must produce /segment not //segment
        const isRoot = pathPrefix === '' || pathPrefix === '/';
        let newShellPath = isRoot
          ? pathSegment
            ? `/${pathSegment}${search}`
            : search
              ? `/${search}`
              : '/'
          : pathSegment
            ? `/${pathPrefix}/${pathSegment}${search}`
            : `/${pathPrefix}${search}`;

        // Normalize: remove trailing slashes from pathname part only (preserve query)
        const urlParts = newShellPath.match(/^([^?#]*)([?#].*)?$/);
        if (urlParts) {
          const pathnamePart = urlParts[1].replace(/\/+$/, '') || '/';
          const queryPart = urlParts[2] || '';
          newShellPath = pathnamePart + queryPart;
        }

        // Normalize current path for comparison (remove trailing slashes from pathname)
        const currentPathname = window.location.pathname.replace(/\/+$/, '') || '/';
        const currentPath = currentPathname + window.location.search + window.location.hash;

        // Normalize new path for comparison
        const newPathParts = newShellPath.match(/^([^?#]*)([?#].*)?$/);
        const normalizedNewPathname = newPathParts?.[1]?.replace(/\/+$/, '') || '/';
        const normalizedNewPath = normalizedNewPathname + (newPathParts?.[2] || '');

        // Mark before navigate so the shell-sync effect does not reload the iframe
        lastShellPathFromIframeRef.current = normalizedNewPath;

        if (currentPath !== normalizedNewPath) {
          if (!isSafeShellPath(normalizedNewPath)) {
            logger.warn('ContentView: refused unsafe shell path from iframe', normalizedNewPath);
            return;
          }
          // Push — iframe pushState is replace-only when embedded, so the shell
          // is the sole owner of back/forward entries.
          navigate(newShellPath);
        }
      },
    );

    return () => {
      cleanup();
    };
  }, [pathPrefix, navigate, navItem, ignoreMessages, isLoading]);

  const scheduleReveal = (reveal: () => void) => {
    const doReveal = () => {
      const elapsed = Date.now() - mountTimeRef.current;
      if (elapsed < MIN_LOADING_MS) {
        const timer = setTimeout(doReveal, MIN_LOADING_MS - elapsed);
        cancelRevealRef.current = () => {
          clearTimeout(timer);
          cancelRevealRef.current = null;
        };
        return;
      }
      reveal();
    };
    requestAnimationFrame(() => requestAnimationFrame(doReveal));
  };

  // Hide loading overlay when iframe sends SHELLUI_INITIALIZED.
  // Defer reveal (double rAF + min time) so the iframe has time to apply theme and paint.
  useEffect(() => {
    const cleanup = shellui.addMessageListener(
      'SHELLUI_INITIALIZED',
      (_data: ShellUIMessage, event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        cancelRevealRef.current?.();
        let cancelled = false;
        cancelRevealRef.current = () => {
          cancelled = true;
          cancelRevealRef.current = null;
        };
        scheduleReveal(() => {
          if (!cancelled) setIsLoading(false);
          cancelRevealRef.current = null;
        });
      },
    );
    return () => {
      cancelRevealRef.current?.();
      cancelRevealRef.current = null;
      cleanup();
    };
  }, [ignoreMessages]);

  // Fallback: hide overlay after LOADING_OVERLAY_DURATION_MS if SHELLUI_INITIALIZED was not received.
  // Also used after location.replace syncs (no full remount / INITIALIZED).
  useEffect(() => {
    if (!isLoading) return;
    const timeoutId = setTimeout(() => {
      logger.info('ContentView: Timeout expired, hiding loading overlay');
      cancelRevealRef.current?.();
      let cancelled = false;
      cancelRevealRef.current = () => {
        cancelled = true;
        cancelRevealRef.current = null;
      };
      scheduleReveal(() => {
        if (!cancelled) setIsLoading(false);
        cancelRevealRef.current = null;
      });
    }, LOADING_OVERLAY_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  // After the first load, a cross-origin document (OAuth/login) cannot be inspected.
  // Flag it so desktop Back can restore the iframe to its assigned app URL.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let loads = 0;
    const onLoad = () => {
      loads += 1;
      try {
        void iframe.contentWindow?.location.href;
        iframe.removeAttribute(IFRAME_FOREIGN_ATTR);
      } catch {
        if (loads > 1) iframe.setAttribute(IFRAME_FOREIGN_ATTR, 'true');
      }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [iframeUrl, navItem?.path, frameGeneration]);

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}
      className="bg-background"
    >
      {/* Note: allow-same-origin is required for same-origin iframe content (e.g., Vite dev server, cookies, localStorage).
          While this allows the iframe to remove its own sandboxing, it's acceptable here because the iframe content
          is trusted microfrontend content from the same application origin.
          Browser security warnings about this combination cannot be suppressed programmatically. */}
      {/* Strategy to prevent browser deprioritizing iframe rendering:
          - loading="eager" explicitly requests immediate loading (not deferred)
          - opacity:0 hides the iframe during loading while keeping it in the rendering pipeline
          - Reveal is instant (no transition) after deferred double-rAF to avoid blink */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        key={`${navItem?.path ?? ''}:${frameGeneration}`}
        loading="eager"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          opacity: isLoading ? 0 : 1,
        }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {isLoading && <LoadingOverlay />}
    </div>
  );
};
