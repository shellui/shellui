import { NavigationItem } from '@/features/config/types';
import { addIframe, removeIframe, shellui } from '@shellui/sdk';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

interface ContentViewProps {
  url: string;
  pathPrefix: string;
  ignoreMessages?: boolean;
  navItem: NavigationItem;
}

export const ContentView = ({ url, pathPrefix, ignoreMessages = false, navItem }: ContentViewProps) => {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isInternalNavigation = useRef(false);
  const [initialUrl] = useState(url);

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

    const cleanup = shellui.addMessageListener('SHELLUI_URL_CHANGED', (event) => {
      if (ignoreMessages) {
        return;
      }
      console.log('SHELLUI_URL_CHANGED', event.payload);
    });

    // Keep handler outside of shellSDK to keep logic simplify as SHELLUI_URL_CHANGED is pretty specific
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (ignoreMessages) {
        return;
      }

      // Only handle messages from this component's iframe
      if (iframeRef.current &&
        event.source !== iframeRef.current.contentWindow &&
        event.source !== null) {
        return;
      }
      if (type === 'SHELLUI_URL_CHANGED') {
        const { pathname, search, hash } = payload;

        // Remove leading slash and trailing slashes from iframe pathname
        let cleanPathname = pathname.startsWith(navItem.url) ? pathname.slice(navItem.url.length) : pathname;
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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      cleanup();
    };
  }, [pathPrefix, navigate]);

  // Handle external URL changes (e.g. from Sidebar)
  useEffect(() => {
    if (iframeRef.current && !isInternalNavigation.current) {
      // Only update iframe src if it's actually different from its current src
      // to avoid unnecessary reloads
      if (iframeRef.current.src !== url) {
        iframeRef.current.src = url;
      }
    }
  }, [url]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <iframe
        ref={iframeRef}
        src={initialUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
        title="Content Frame"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
};
