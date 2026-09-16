import { shellui, type OpenModalOptions, type ShellUIMessage } from '@shellui/sdk';
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useConfig } from '../config/useConfig';
import { validateAndNormalizeUrl } from './validateAndNormalizeUrl';

export { validateAndNormalizeUrl } from './validateAndNormalizeUrl';

interface ModalContextValue {
  isOpen: boolean;
  modalUrl: string | null;
  options: OpenModalOptions | null;
  openModal: (urlOrOptions?: string | OpenModalOptions) => void;
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
  const { config } = useConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<OpenModalOptions | null>(null);

  const openModal = useCallback(
    (urlOrOptions?: string | OpenModalOptions) => {
      const opts: OpenModalOptions =
        typeof urlOrOptions === 'string' || urlOrOptions === undefined
          ? { url: urlOrOptions }
          : urlOrOptions;
      const validatedUrl = opts.url ? validateAndNormalizeUrl(opts.url, config) : null;
      setModalUrl(validatedUrl);
      setOptions(opts);
      setIsOpen(true);
    },
    [config],
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Clear URL after a short delay to allow animation to complete
    setTimeout(() => {
      setModalUrl(null);
      setOptions(null);
    }, 200);
  }, []);

  // Listen for postMessage events from nested iframes
  useEffect(() => {
    const cleanupOpenModal = shellui.addMessageListener(
      'SHELLUI_OPEN_MODAL',
      (data: ShellUIMessage) => {
        const payload = data.payload as OpenModalOptions & { url?: string | null };
        openModal({
          ...payload,
          url: payload.url ?? undefined,
        });
      },
    );

    const cleanupCloseModal = shellui.addMessageListener('SHELLUI_CLOSE_MODAL', () => {
      closeModal();
    });

    return () => {
      cleanupOpenModal();
      cleanupCloseModal();
    };
  }, [openModal, closeModal]);

  return (
    <ModalContext.Provider value={{ isOpen, modalUrl, options, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
};
