import { shellui, ShellUIMessage } from '@shellui/sdk';
import { createContext, useContext, useCallback, ReactNode, useEffect, useRef, useState } from 'react';

/** Match exit animation duration in index.css (overlay + content ~0.1s + buffer) */
const DIALOG_EXIT_ANIMATION_MS = 200;
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Trash icon (matches lucide trash-2) */
const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
);

export type DialogMode = 'ok' | 'okCancel' | 'delete' | 'confirm' | 'onlyCancel';

export type AlertDialogSize = 'default' | 'sm';

interface DialogOptions {
  id?: string;
  title: string;
  description?: string;
  mode?: DialogMode;
  okLabel?: string;
  cancelLabel?: string;
  size?: AlertDialogSize;
  onOk?: () => void;
  onCancel?: () => void;
}

interface DialogContextValue {
  dialog: (options: DialogOptions) => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

interface DialogProviderProps {
  children: ReactNode;
}

interface DialogState {
  id: string;
  title: string;
  description?: string;
  mode: DialogMode;
  okLabel?: string;
  cancelLabel?: string;
  size?: AlertDialogSize;
  from?: string[];
}

export const DialogProvider = ({ children }: DialogProviderProps) => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const unmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUnmount = useCallback(() => {
    if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    unmountTimeoutRef.current = setTimeout(() => {
      unmountTimeoutRef.current = null;
      setDialogState(null);
    }, DIALOG_EXIT_ANIMATION_MS);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open && dialogState) {
      // If dialog was closed without clicking a button (X button or outside click),
      // trigger cancel callback if it exists
      if (dialogState.from && dialogState.from.length > 0) {
        shellui.sendMessage({
          type: 'SHELLUI_DIALOG_CANCEL',
          payload: { id: dialogState.id },
          to: dialogState.from,
        });
      }
      // Unmount after exit animation finishes
      scheduleUnmount();
    }
  }, [dialogState, scheduleUnmount]);

  const handleOk = useCallback(() => {
    if (dialogState?.from && dialogState.from.length > 0) {
      shellui.sendMessage({
        type: 'SHELLUI_DIALOG_OK',
        payload: { id: dialogState.id },
        to: dialogState.from,
      });
    }
    setIsOpen(false);
    scheduleUnmount();
  }, [dialogState, scheduleUnmount]);

  const handleCancel = useCallback(() => {
    if (dialogState?.from && dialogState.from.length > 0) {
      shellui.sendMessage({
        type: 'SHELLUI_DIALOG_CANCEL',
        payload: { id: dialogState.id },
        to: dialogState.from,
      });
    }
    setIsOpen(false);
    scheduleUnmount();
  }, [dialogState, scheduleUnmount]);

  const dialog = useCallback((options: DialogOptions) => {
    // Only show dialog if window is root
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }
    if (unmountTimeoutRef.current) {
      clearTimeout(unmountTimeoutRef.current);
      unmountTimeoutRef.current = null;
    }

    setDialogState({
      id: options.id || '',
      title: options.title,
      description: options.description,
      mode: options.mode || 'ok',
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
      size: options.size,
    });
    setIsOpen(true);
  }, []);

  // Listen for postMessage events from nested iframes
  useEffect(() => {
    // Only listen if window is root
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const cleanupDialog = shellui.addMessageListener('SHELLUI_DIALOG', (data: ShellUIMessage) => {
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current);
        unmountTimeoutRef.current = null;
      }
      const payload = data.payload as DialogOptions & { id: string };
      setDialogState({
        id: payload.id,
        title: payload.title,
        description: payload.description,
        mode: payload.mode || 'ok',
        okLabel: payload.okLabel,
        cancelLabel: payload.cancelLabel,
        size: payload.size,
        from: data.from,
      });
      setIsOpen(true);
    });

    const cleanupDialogUpdate = shellui.addMessageListener('SHELLUI_DIALOG_UPDATE', (data: ShellUIMessage) => {
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current);
        unmountTimeoutRef.current = null;
      }
      const payload = data.payload as DialogOptions & { id: string };
      setDialogState({
        id: payload.id,
        title: payload.title,
        description: payload.description,
        mode: payload.mode || 'ok',
        okLabel: payload.okLabel,
        cancelLabel: payload.cancelLabel,
        size: payload.size,
        from: data.from,
      });
      setIsOpen(true);
    });

    return () => {
      cleanupDialog();
      cleanupDialogUpdate();
      if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    };
  }, []);

  const renderButtons = () => {
    if (!dialogState) return null;

    const { mode, okLabel, cancelLabel } = dialogState;

    switch (mode) {
      case 'ok':
        return (
          <AlertDialogAction onClick={handleOk}>
            {okLabel || 'OK'}
          </AlertDialogAction>
        );

      case 'okCancel':
        return (
          <>
            <AlertDialogCancel variant="outline" onClick={handleCancel}>
              {cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOk}>
              {okLabel || 'OK'}
            </AlertDialogAction>
          </>
        );

      case 'delete':
        return (
          <>
            <AlertDialogCancel variant="outline" onClick={handleCancel}>
              {cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleOk}>
              {okLabel || 'Delete'}
            </AlertDialogAction>
          </>
        );

      case 'confirm':
        return (
          <>
            <AlertDialogCancel variant="outline" onClick={handleCancel}>
              {cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOk}>
              {okLabel || 'Confirm'}
            </AlertDialogAction>
          </>
        );

      case 'onlyCancel':
        return (
          <AlertDialogCancel variant="outline" onClick={handleCancel}>
            {cancelLabel || 'Cancel'}
          </AlertDialogCancel>
        );

      default:
        return (
          <AlertDialogAction onClick={handleOk}>
            {okLabel || 'OK'}
          </AlertDialogAction>
        );
    }
  };

  return (
    <DialogContext.Provider value={{ dialog }}>
      {children}
      {dialogState && (
        <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
          <AlertDialogContent size={dialogState.size ?? 'default'}>
            <AlertDialogHeader>
              {dialogState.mode === 'delete' && (
                <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                  <TrashIcon />
                </AlertDialogMedia>
              )}
              <AlertDialogTitle>{dialogState.title}</AlertDialogTitle>
              {dialogState.description && (
                <AlertDialogDescription>{dialogState.description}</AlertDialogDescription>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              {renderButtons()}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DialogContext.Provider>
  );
};
