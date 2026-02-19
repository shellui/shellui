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
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { LOADING_OVERLAY_DURATION_MS } from '../constants/loading';
import { LoadingOverlay } from './LoadingOverlay';

const logger = getLogger('shellcore');

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cancelRevealRef = useRef<(() => void) | null>(null);
  const mountTimeRef = useRef(Date.now());

  const [isLoading, setIsLoading] = useState(() => {
    // Skip overlay when same app URL was just loaded (e.g. switching App ↔ Root with same url)
    if (!ignoreMessages) return false;
    return true;
  });

  const [iframeUrl, setIframeUrl] = useState(url);

  const MIN_LOADING_MS = 80; // Don't reveal before this, reduces blink from theme/layout paint

  useEffect(() => {
    if (!iframeRef.current) {
      return;
    }
    const iframeId = addIframe(iframeRef.current);
    return () => {
      removeIframe(iframeId);
    };
  }, []);

  useEffect(() => {
    if (ignoreMessages) return;
    if (isLoading) return;
    if (iframeRef.current) {
      setIsLoading(true);
      setIframeUrl('about:blank');
      setTimeout(() => {
        setIframeUrl(url);
      }, 100);
    }
  }, [navItem]);

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

        if (currentPath !== normalizedNewPath) {
          navigate(newShellPath, { replace: true });
        }
      },
    );

    return () => {
      cleanup();
    };
  }, [pathPrefix, navigate, navItem]);

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
  // Remember this URL so we can skip the overlay when navigating to the same app (e.g. App ↔ Root).
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
