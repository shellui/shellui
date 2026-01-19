import { shellui } from '@shellui/sdk';
import { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'default' | 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
}

interface SonnerContextValue {
  toast: (options: ToastOptions) => void;
}

const SonnerContext = createContext<SonnerContextValue | undefined>(undefined);

export const useSonner = () => {
  const context = useContext(SonnerContext);
  if (!context) {
    throw new Error('useSonner must be used within a SonnerProvider');
  }
  return context;
};

interface SonnerProviderProps {
  children: ReactNode;
}

export const SonnerProvider = ({ children }: SonnerProviderProps) => {
  const toast = useCallback((options: ToastOptions) => {
    const { title, description, type = 'default', duration, action, cancel } = options;

    const toastOptions: Parameters<typeof sonnerToast>[1] = {
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      cancel: cancel ? {
        label: cancel.label,
        onClick: cancel.onClick,
      } : undefined,
    };

    switch (type) {
      case 'success':
        sonnerToast.success(title || 'Success', {
          description,
          ...toastOptions,
        });
        break;
      case 'error':
        sonnerToast.error(title || 'Error', {
          description,
          ...toastOptions,
        });
        break;
      case 'warning':
        sonnerToast.warning(title || 'Warning', {
          description,
          ...toastOptions,
        });
        break;
      case 'info':
        sonnerToast.info(title || 'Info', {
          description,
          ...toastOptions,
        });
        break;
      default:
        sonnerToast(title || 'Notification', {
          description,
          ...toastOptions,
        });
        break;
    }
  }, []);

  // Listen for postMessage events from nested iframes
  useEffect(() => {

    const cleanup = shellui.addMessageListener('SHELLUI_TOAST', (data) => {
      const payload = data.payload as ToastOptions;
      toast(payload);
    });

    return () => {
      cleanup();
    }
  }, [toast]);

  return (
    <SonnerContext.Provider value={{ toast }}>
      {children}
    </SonnerContext.Provider>
  );
};
