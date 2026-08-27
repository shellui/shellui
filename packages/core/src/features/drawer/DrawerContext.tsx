import { shellui, type OpenDrawerOptions, type ShellUIMessage } from '@shellui/sdk';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { DrawerDirection } from '../../components/ui/drawer';
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

/** Match Vaul exit so content stays mounted through the close animation. */
const DRAWER_CLOSE_CLEAR_MS = 300;

interface DrawerContextValue {
  isOpen: boolean;
  drawerUrl: string | null;
  position: DrawerDirection;
  options: OpenDrawerOptions | null;
  /** @deprecated Prefer options.size — kept for callers reading the resolved CSS/preset string. */
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
  const [options, setOptions] = useState<OpenDrawerOptions | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDrawer = useCallback(
    (openOptions?: OpenDrawerOptions) => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      closeModal();
      const url = openOptions?.url;
      const validatedUrl = url ? validateAndNormalizeUrl(url) : null;
      setDrawerUrl(validatedUrl);
      setPosition(openOptions?.position ?? DEFAULT_DRAWER_POSITION);
      setOptions(openOptions ?? null);
      setIsOpen(true);
    },
    [closeModal],
  );

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    // Keep url/position through Vaul's exit animation, then clear so the next open
    // remounts ContentView and shows the normal loading bar again (not dynamic sizing).
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      clearTimerRef.current = null;
      setDrawerUrl(null);
      setOptions(null);
      setPosition(DEFAULT_DRAWER_POSITION);
    }, DRAWER_CLOSE_CLEAR_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const cleanupOpen = shellui.addMessageListener(
      'SHELLUI_OPEN_DRAWER',
      (data: ShellUIMessage) => {
        const payload = data.payload as OpenDrawerOptions;
        openDrawer(payload);
      },
    );

    const cleanupClose = shellui.addMessageListener('SHELLUI_CLOSE_DRAWER', () => {
      closeDrawer();
    });

    return () => {
      cleanupOpen();
      cleanupClose();
    };
  }, [openDrawer, closeDrawer]);

  const size = options?.size !== undefined && options?.size !== null ? String(options.size) : null;

  return (
    <DrawerContext.Provider
      value={{
        isOpen,
        drawerUrl,
        position,
        options,
        size,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
};
