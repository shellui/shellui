import { shellui } from '@shellui/sdk';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

/**
 * Validates and normalizes a URL to ensure it's from the same domain or localhost
 * @param url - The URL or path to validate
 * @returns The normalized absolute URL or null if invalid
 */
export const validateAndNormalizeUrl = (url: string | undefined | null): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // If it's already an absolute URL, check if it's same origin or localhost
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      // Allow same origin
      if (urlObj.origin === currentOrigin) {
        return url;
      }

      // Allow localhost URLs (for development)
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return url;
      }

      return null; // Different origin, reject for security
    }

    // If it's a relative URL, make it absolute using current origin
    if (url.startsWith('/') || url.startsWith('./') || !url.startsWith('//')) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      // Ensure relative paths start with /
      const normalizedPath = url.startsWith('/') ? url : `/${url}`;
      return `${currentOrigin}${normalizedPath}`;
    }

    // Reject protocol-relative URLs (//example.com) for security
    return null;
  } catch (error) {
    console.error('Invalid URL:', url, error);
    return null;
  }
};

interface ModalContextValue {
  isOpen: boolean;
  modalUrl: string | null;
  openModal: (url?: string) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider = ({ children }: ModalProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  const openModal = useCallback((url?: string) => {
    const validatedUrl = url ? validateAndNormalizeUrl(url) : null;
    setModalUrl(validatedUrl);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Clear URL after a short delay to allow animation to complete
    setTimeout(() => setModalUrl(null), 200);
  }, []);


  // Listen for postMessage events from nested iframes
  useEffect(() => {
    const cleanupOpenModal = shellui.addMessageListener('SHELLUI_OPEN_MODAL', (data) => {
      const payload = data.payload as { url?: string };
      openModal(payload.url);
    });

    const cleanupCloseModal = shellui.addMessageListener('SHELLUI_CLOSE_MODAL', () => {
      closeModal();
    });

    return () => {
      cleanupOpenModal();
      cleanupCloseModal();
    }
  }, [openModal, closeModal]);

  return (
    <ModalContext.Provider value={{ isOpen, modalUrl, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
};
