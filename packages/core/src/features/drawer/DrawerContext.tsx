import { shellui, ShellUIMessage } from '@shellui/sdk';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { DrawerDirection } from '@/components/ui/drawer';

/**
 * Validates and normalizes a URL to ensure it's from the same domain or localhost
 */
const validateAndNormalizeUrl = (url: string | undefined | null): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      if (urlObj.origin === currentOrigin) return url;
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') return url;
      return null;
    }

    if (url.startsWith('/') || url.startsWith('./') || !url.startsWith('//')) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const normalizedPath = url.startsWith('/') ? url : `/${url}`;
      return `${currentOrigin}${normalizedPath}`;
    }

    return null;
  } catch {
    return null;
  }
};

export const DEFAULT_DRAWER_POSITION: DrawerDirection = 'right';

interface DrawerContextValue {
  isOpen: boolean;
  drawerUrl: string | null;
  position: DrawerDirection;
  openDrawer: (url?: string, position?: DrawerDirection) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue | undefined>(undefined);

export const useDrawer = () => {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
};

interface DrawerProviderProps {
  children: ReactNode;
}

export const DrawerProvider = ({ children }: DrawerProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerUrl, setDrawerUrl] = useState<string | null>(null);
  const [position, setPosition] = useState<DrawerDirection>(DEFAULT_DRAWER_POSITION);

  const openDrawer = useCallback((url?: string, pos?: DrawerDirection) => {
    const validatedUrl = url ? validateAndNormalizeUrl(url) : null;
    setDrawerUrl(validatedUrl);
    setPosition(pos ?? DEFAULT_DRAWER_POSITION);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    // Do not reset drawerUrl/position here — Vaul's close animation uses the current
    // direction. Resetting position (e.g. to 'right') mid-animation would make
    // non-right drawers jump. State is set on next openDrawer().
  }, []);

  useEffect(() => {
    const cleanupOpen = shellui.addMessageListener('SHELLUI_OPEN_DRAWER', (data: ShellUIMessage) => {
      const payload = data.payload as { url?: string; position?: DrawerDirection };
      openDrawer(payload.url, payload.position);
    });

    const cleanupClose = shellui.addMessageListener('SHELLUI_CLOSE_DRAWER', () => {
      closeDrawer();
    });

    return () => {
      cleanupOpen();
      cleanupClose();
    };
  }, [openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider
      value={{ isOpen, drawerUrl, position, openDrawer, closeDrawer }}
    >
      {children}
    </DrawerContext.Provider>
  );
};
