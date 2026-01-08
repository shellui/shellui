import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ContentViewProps {
  url: string;
  pathPrefix: string;
}

export const ContentView = ({ url, pathPrefix }: ContentViewProps) => {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isInternalNavigation = useRef(false);
  const [initialUrl] = useState(url);

  // Sync parent URL when iframe notifies us of a change
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'SHELLUI_URL_CHANGED') {
        const { pathname, search, hash } = payload;
        
        const cleanPathname = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        const newShellPath = `/${pathPrefix}/${cleanPathname}${search}${hash}`;
        
        if (window.location.pathname + window.location.search + window.location.hash !== newShellPath) {
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
    return () => window.removeEventListener('message', handleMessage);
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
