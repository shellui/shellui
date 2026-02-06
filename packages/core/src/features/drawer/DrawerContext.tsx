import { shellui, type ShellUIMessage } from '@shellui/sdk';
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { DrawerDirection } from '@/components/ui/drawer';
import { useModal } from '../modal/ModalContext';

/**
 * Validates and normalizes a URL for the drawer iframe.
 * Allows same-origin, localhost, and external http(s) URLs (e.g. from nav config).
 */
const validateAndNormalizeUrl = (url: string | undefined | null): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      new URL(url); // validate
      return url;
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

interface OpenDrawerOptions {
  url?: string;
  position?: DrawerDirection;
  /** CSS length: height for top/bottom (e.g. "80vh", "400px"), width for left/right (e.g. "50vw", "320px") */
  size?: string;
}

interface DrawerContextValue {
  isOpen: boolean;
  drawerUrl: string | null;
  position: DrawerDirection;
  size: string | null;
  openDrawer: (options?: OpenDrawerOptions) => void;
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
  const { closeModal } = useModal();
  const [isOpen, setIsOpen] = useState(false);
  const [drawerUrl, setDrawerUrl] = useState<string | null>(null);
  const [position, setPosition] = useState<DrawerDirection>(DEFAULT_DRAWER_POSITION);
  const [size, setSize] = useState<string | null>(null);

  const openDrawer = useCallback((options?: OpenDrawerOptions) => {
    closeModal();
    const url = options?.url;
    const validatedUrl = url ? validateAndNormalizeUrl(url) : null;
    setDrawerUrl(validatedUrl);
    setPosition(options?.position ?? DEFAULT_DRAWER_POSITION);
    setSize(options?.size ?? null);
    setIsOpen(true);
  }, [closeModal]);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    // Do not reset drawerUrl/position here — Vaul's close animation uses the current
    // direction. Resetting position (e.g. to 'right') mid-animation would make
    // non-right drawers jump. State is set on next openDrawer().
  }, []);

  useEffect(() => {
    const cleanupOpen = shellui.addMessageListener('SHELLUI_OPEN_DRAWER', (data: ShellUIMessage) => {
      const payload = data.payload as { url?: string; position?: DrawerDirection; size?: string };
      openDrawer({ url: payload.url, position: payload.position, size: payload.size });
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
      value={{ isOpen, drawerUrl, position, size, openDrawer, closeDrawer }}
    >
      {children}
    </DrawerContext.Provider>
  );
};
