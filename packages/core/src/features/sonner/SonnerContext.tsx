import { shellui, type ShellUIMessage } from '@shellui/sdk';
import { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  type?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
}

interface SonnerContextValue {
  toast: (options: ToastOptions) => void;
}

const SonnerContext = createContext<SonnerContextValue | undefined>(undefined);

export function useSonner() {
  const context = useContext(SonnerContext);
  if (!context) {
    throw new Error('useSonner must be used within a SonnerProvider');
  }
  return context;
}

interface SonnerProviderProps {
  children: ReactNode;
}

/** Root-window toasts store callbacks locally; iframe toasts route via postMessage. */
function createToastButtonHandler(
  toastId: string | undefined,
  from: string[] | undefined,
  kind: 'action' | 'cancel',
): (() => void) | undefined {
  if (!toastId) return undefined;
  let sent = false;
  return () => {
    if (sent) return;
    sent = true;
    if (!from?.length) {
      if (kind === 'action') {
        shellui.callbackRegistry.triggerAction(toastId);
      } else {
        shellui.callbackRegistry.triggerCancel(toastId);
      }
      shellui.callbackRegistry.clear(toastId);
      return;
    }
    shellui.sendMessage({
      type: kind === 'action' ? 'SHELLUI_TOAST_ACTION' : 'SHELLUI_TOAST_CANCEL',
      payload: { id: toastId },
      to: from,
    });
  };
}

export const SonnerProvider = ({ children }: SonnerProviderProps) => {
  const toast = useCallback((options: ToastOptions) => {
    const {
      id,
      title,
      description,
      type = 'default',
      duration,
      position,
      action,
      cancel,
      onDismiss,
      onAutoClose,
    } = options;

    const toastOptions: Parameters<typeof sonnerToast>[1] = {
      id,
      duration,
      position,
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
      cancel: cancel
        ? {
            label: cancel.label,
            onClick: cancel.onClick,
          }
        : undefined,
      onDismiss: onDismiss,
      onAutoClose: onAutoClose,
    };

    // If ID is provided, this is an update operation
    if (id) {
      switch (type) {
        case 'success':
          sonnerToast.success(title || 'Success', {
            id,
            description,
            ...toastOptions,
          });
          break;
        case 'error':
          sonnerToast.error(title || 'Error', {
            id,
            description,
            ...toastOptions,
          });
          break;
        case 'warning':
          sonnerToast.warning(title || 'Warning', {
            id,
            description,
            ...toastOptions,
          });
          break;
        case 'info':
          sonnerToast.info(title || 'Info', {
            id,
            description,
            ...toastOptions,
          });
          break;
        case 'loading':
          sonnerToast.loading(title || 'Loading...', {
            id,
            description,
            ...toastOptions,
          });
          break;
        default:
          sonnerToast(title || 'Notification', {
            id,
            description,
            ...toastOptions,
          });
          break;
      }
      return;
    }

    // Create new toast
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
      case 'loading':
        sonnerToast.loading(title || 'Loading...', {
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
    const cleanupToast = shellui.addMessageListener('SHELLUI_TOAST', (data: ShellUIMessage) => {
      const payload = data.payload as ToastOptions;
      toast({
        ...payload,
        onDismiss: () => {
          shellui.sendMessage({
            type: 'SHELLUI_TOAST_CLEAR',
            payload: { id: payload.id },
            to: data.from,
          });
        },
        onAutoClose: () => {
          shellui.sendMessage({
            type: 'SHELLUI_TOAST_CLEAR',
            payload: { id: payload.id },
            to: data.from,
          });
        },
        action:
          payload.action &&
          (() => ({
            label: payload.action?.label ?? undefined,
            onClick: createToastButtonHandler(payload.id, data.from, 'action') ?? (() => {}),
          }))(),
        cancel:
          payload.cancel &&
          (() => ({
            label: payload.cancel?.label ?? undefined,
            onClick: createToastButtonHandler(payload.id, data.from, 'cancel') ?? (() => {}),
          }))(),
      });
    });

    const cleanupToastUpdate = shellui.addMessageListener(
      'SHELLUI_TOAST_UPDATE',
      (data: ShellUIMessage) => {
        const payload = data.payload as ToastOptions;
        // CRITICAL: When updating a toast, we MUST re-register action handlers
        // The callbackRegistry still has the callbacks, but the toast button needs onClick handlers
        // that trigger the callbackRegistry via SHELLUI_TOAST_ACTION messages
        toast({
          ...payload,
          // Re-register action handlers so the button works after update
          // These handlers send messages that trigger the callbackRegistry
          action:
            payload.action &&
            (() => ({
              label: payload.action?.label ?? undefined,
              onClick: createToastButtonHandler(payload.id, data.from, 'action') ?? (() => {}),
            }))(),
          cancel:
            payload.cancel &&
            (() => ({
              label: payload.cancel?.label ?? undefined,
              onClick: createToastButtonHandler(payload.id, data.from, 'cancel') ?? (() => {}),
            }))(),
        });
      },
    );

    return () => {
      cleanupToast();
      cleanupToastUpdate();
    };
  }, [toast]);

  return <SonnerContext.Provider value={{ toast }}>{children}</SonnerContext.Provider>;
};
