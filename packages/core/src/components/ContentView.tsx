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
import { LoadingOverlay } from './LoadingOverlay';

const logger = getLogger('shellcore');

interface ContentViewProps {
  url: string;
  /** Base URL for this content (effective nav item URL). Used for URL sync; when omitted, falls back to navItem.url or url. */
  baseUrl?: string;
  pathPrefix: string;
  ignoreMessages?: boolean;
  /** Nav item for this content; may be undefined when opening by URL (e.g. settings modal) if no matching item found. */
  navItem?: NavigationItem | null;
}

export const ContentView = ({
  url,
  baseUrl: baseUrlProp,
  pathPrefix,
  ignoreMessages = false,
  navItem,
}: ContentViewProps) => {
  const baseUrl = baseUrlProp ?? navItem?.url ?? url;
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isInternalNavigation = useRef(false);
  const [initialUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);

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
        // Use pathname part of baseUrl for comparison (iframe pathname is always path-only)
        const basePathname =
          baseUrl.startsWith('http') || baseUrl.startsWith('//')
            ? new URL(baseUrl, window.location.origin).pathname
            : baseUrl;
        let cleanPathname = pathname.startsWith(basePathname)
          ? pathname.slice(basePathname.length)
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
  }, [pathPrefix, navigate, baseUrl]);

  // Hide loading overlay when iframe sends SHELLUI_INITIALIZED
  useEffect(() => {
    const cleanup = shellui.addMessageListener(
      'SHELLUI_INITIALIZED',
      (_data: ShellUIMessage, event: MessageEvent) => {
        if (event.source === iframeRef.current?.contentWindow) {
          setIsLoading(false);
        }
      },
    );
    return () => cleanup();
  }, []);

  // Fallback: hide overlay after 400ms if SHELLUI_INITIALIZED was not received
  useEffect(() => {
    if (!isLoading) return;
    const timeoutId = setTimeout(() => {
      logger.info('ContentView: Timeout expired, hiding loading overlay');
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  // Handle external URL changes (e.g. from Sidebar)
  useEffect(() => {
    if (iframeRef.current && !isInternalNavigation.current) {
      // Only update iframe src if it's actually different from its current src
      // to avoid unnecessary reloads
      if (iframeRef.current.src !== url) {
        iframeRef.current.src = url;
        setIsLoading(true);
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
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      {/* Note: allow-same-origin is required for same-origin iframe content (e.g., Vite dev server, cookies, localStorage).
          While this allows the iframe to remove its own sandboxing, it's acceptable here because the iframe content
          is trusted microfrontend content from the same application origin.
          Browser security warnings about this combination cannot be suppressed programmatically. */}
      <iframe
        ref={iframeRef}
        src={initialUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {isLoading && <LoadingOverlay />}
    </div>
  );
};
