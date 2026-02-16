/* eslint-disable no-console */
import type { NavigationItem } from '../features/config/types';
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
import { LOADING_OVERLAY_DURATION_MS } from '../constants';
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
  const isInternalNavigation = useRef(false);
  const cancelRevealRef = useRef<(() => void) | null>(null);
  const mountTimeRef = useRef(Date.now());
  const [initialUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);

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

  // Sync parent URL when iframe notifies us of a change
  useEffect(() => {
    const cleanup = shellui.addMessageListener(
      'SHELLUI_URL_CHANGED',
      (data: ShellUIMessage, event: MessageEvent) => {
        if (ignoreMessages) {
          return;
        }

        // Ignore URL CHANGE from other than ContentView iframe
        if (event.source !== iframeRef.current?.contentWindow) {
          return;
        }

        const { pathname, search, hash } = data.payload as ShellUIUrlPayload;
        // Remove leading slash and trailing slashes from iframe pathname
        let cleanPathname = pathname.startsWith(navItem.url)
          ? pathname.slice(navItem.url.length)
          : pathname;
        cleanPathname = cleanPathname.startsWith('/') ? cleanPathname.slice(1) : cleanPathname;
        cleanPathname = cleanPathname.replace(/\/+$/, ''); // Remove trailing slashes
        // Construct the new path without trailing slashes
        let newShellPath = cleanPathname
          ? `/${pathPrefix}/${cleanPathname}${search}${hash}`
          : `/${pathPrefix}${search}${hash}`;

        // Normalize: remove trailing slashes from pathname part only (preserve query/hash)
        const urlParts = newShellPath.match(/^([^?#]*)([?#].*)?$/);
        if (urlParts) {
          const pathnamePart = urlParts[1].replace(/\/+$/, '') || '/';
          const queryHashPart = urlParts[2] || '';
          newShellPath = pathnamePart + queryHashPart;
        }

        // Normalize current path for comparison (remove trailing slashes from pathname)
        const currentPathname = window.location.pathname.replace(/\/+$/, '') || '/';
        const currentPath = currentPathname + window.location.search + window.location.hash;

        // Normalize new path for comparison
        const newPathParts = newShellPath.match(/^([^?#]*)([?#].*)?$/);
        const normalizedNewPathname = newPathParts?.[1]?.replace(/\/+$/, '') || '/';
        const normalizedNewPath = normalizedNewPathname + (newPathParts?.[2] || '');

        if (currentPath !== normalizedNewPath) {
          // Mark this navigation as internal so we don't try to "push" it back to the iframe
          isInternalNavigation.current = true;
          navigate(newShellPath, { replace: true });

          // Reset the flag after a short delay to allow the render cycle to complete
          setTimeout(() => {
            isInternalNavigation.current = false;
          }, 100);
        }
      },
    );

    return () => {
      cleanup();
    };
  }, [pathPrefix, navigate]);

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
  }, []);

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

  // Handle external URL changes (e.g. from Sidebar)
  useEffect(() => {
    if (iframeRef.current && !isInternalNavigation.current) {
      if (iframeRef.current.src !== url) {
        iframeRef.current.src = url;
        setIsLoading(true);
        mountTimeRef.current = Date.now(); // apply min delay for this load too
      }
    }
  }, [url]);

  // Inject script to prevent "Layout was forced" warning by deferring layout until stylesheets load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const iframeWindow = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument || iframeWindow?.document;
        if (!iframeDoc || !iframeWindow) return;

        // Inject a script that waits for stylesheets before allowing layout calculations
        const script = iframeDoc.createElement('script');
        script.textContent = `
          (function() {
            // Wait for all stylesheets to load
            function waitForStylesheets() {
              const styleSheets = Array.from(document.styleSheets);
              const pendingSheets = styleSheets.filter(function(sheet) {
                try {
                  return sheet.cssRules === null;
                } catch (e) {
                  return false; // Cross-origin stylesheets, assume loaded
                }
              });
              
              if (pendingSheets.length === 0) {
                // All stylesheets loaded
                return;
              }
              
              // Check again after a short delay
              setTimeout(waitForStylesheets, 10);
            }
            
            // Start checking after DOM is ready
            if (document.readyState === 'complete') {
              waitForStylesheets();
            } else {
              window.addEventListener('load', waitForStylesheets);
            }
          })();
        `;
        iframeDoc.head.appendChild(script);
      } catch (error) {
        // Cross-origin or other errors - ignore (this is expected for some iframes)
        logger.debug('Could not inject stylesheet wait script:', { error });
      }
    };

    // Wait for iframe to load before injecting script
    iframe.addEventListener('load', handleLoad);

    // Also try immediately if already loaded
    if (iframe.contentDocument?.readyState === 'complete') {
      handleLoad();
    }

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [initialUrl]);

  // Suppress browser warnings that are expected and acceptable
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        const message = String(args[0] ?? '');
        // Suppress the specific sandbox warning
        if (
          message.includes('allow-scripts') &&
          message.includes('allow-same-origin') &&
          message.includes('sandbox')
        ) {
          return;
        }
        // Suppress "Layout was forced" warning from iframe content
        // This is a performance warning that occurs when iframe content calculates layout before stylesheets load
        // It's harmless and common in iframe scenarios, especially with React apps
        if (
          message.includes('Layout was forced') &&
          message.includes('before the page was fully loaded')
        ) {
          return;
        }
        originalWarn.apply(console, args);
      };
      return () => {
        console.warn = originalWarn;
      };
    }
  }, []);

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
        src={initialUrl}
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
