import { shellui } from '@shellui/sdk';
import { createContext, useContext, useCallback, ReactNode, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type DialogMode = 'ok' | 'okCancel' | 'delete' | 'confirm' | 'onlyCancel';

interface DialogOptions {
  id?: string;
  title: string;
  description?: string;
  mode?: DialogMode;
  okLabel?: string;
  cancelLabel?: string;
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
  from?: string[];
}

export const DialogProvider = ({ children }: DialogProviderProps) => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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
      // Clear dialog state when closed
      setDialogState(null);
    }
  }, [dialogState]);

  const handleOk = useCallback(() => {
    if (dialogState?.from && dialogState.from.length > 0) {
      shellui.sendMessage({
        type: 'SHELLUI_DIALOG_OK',
        payload: { id: dialogState.id },
        to: dialogState.from,
      });
    }
    setIsOpen(false);
    setDialogState(null);
  }, [dialogState]);

  const handleCancel = useCallback(() => {
    if (dialogState?.from && dialogState.from.length > 0) {
      shellui.sendMessage({
        type: 'SHELLUI_DIALOG_CANCEL',
        payload: { id: dialogState.id },
        to: dialogState.from,
      });
    }
    setIsOpen(false);
    setDialogState(null);
  }, [dialogState]);

  const dialog = useCallback((options: DialogOptions) => {
    // Only show dialog if window is root
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    setDialogState({
      id: options.id || '',
      title: options.title,
      description: options.description,
      mode: options.mode || 'ok',
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
    });
    setIsOpen(true);
  }, []);

  // Listen for postMessage events from nested iframes
  useEffect(() => {
    // Only listen if window is root
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const cleanupDialog = shellui.addMessageListener('SHELLUI_DIALOG', (data) => {
      const payload = data.payload as DialogOptions & { id: string };
      setDialogState({
        id: payload.id,
        title: payload.title,
        description: payload.description,
        mode: payload.mode || 'ok',
        okLabel: payload.okLabel,
        cancelLabel: payload.cancelLabel,
        from: data.from,
      });
      setIsOpen(true);
    });

    const cleanupDialogUpdate = shellui.addMessageListener('SHELLUI_DIALOG_UPDATE', (data) => {
      const payload = data.payload as DialogOptions & { id: string };
      setDialogState({
        id: payload.id,
        title: payload.title,
        description: payload.description,
        mode: payload.mode || 'ok',
        okLabel: payload.okLabel,
        cancelLabel: payload.cancelLabel,
        from: data.from,
      });
      setIsOpen(true);
    });

    return () => {
      cleanupDialog();
      cleanupDialogUpdate();
    };
  }, []);

  const renderButtons = () => {
    if (!dialogState) return null;

    const { mode, okLabel, cancelLabel } = dialogState;

    switch (mode) {
      case 'ok':
        return (
          <Button 
            onClick={handleOk} 
            variant="default"
            className="font-semibold shadow-md"
          >
            {okLabel || 'OK'}
          </Button>
        );
      
      case 'okCancel':
        return (
          <>
            <Button 
              onClick={handleCancel} 
              variant="outline"
              className="font-medium"
            >
              {cancelLabel || 'Cancel'}
            </Button>
            <Button 
              onClick={handleOk} 
              variant="default"
              className="font-semibold shadow-md"
            >
              {okLabel || 'OK'}
            </Button>
          </>
        );
      
      case 'delete':
        return (
          <>
            <Button 
              onClick={handleCancel} 
              variant="outline"
              className="font-medium"
            >
              {cancelLabel || 'Cancel'}
            </Button>
            <Button 
              onClick={handleOk} 
              variant="default"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md"
            >
              {okLabel || 'Delete'}
            </Button>
          </>
        );
      
      case 'confirm':
        return (
          <>
            <Button 
              onClick={handleCancel} 
              variant="outline"
              className="font-medium"
            >
              {cancelLabel || 'Cancel'}
            </Button>
            <Button 
              onClick={handleOk} 
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md"
            >
              {okLabel || 'Confirm'}
            </Button>
          </>
        );
      
      case 'onlyCancel':
        return (
          <Button 
            onClick={handleCancel} 
            variant="outline"
            className="font-medium"
          >
            {cancelLabel || 'Cancel'}
          </Button>
        );
      
      default:
        return (
          <Button 
            onClick={handleOk} 
            variant="default"
            className="font-semibold shadow-md"
          >
            {okLabel || 'OK'}
          </Button>
        );
    }
  };

  return (
    <DialogContext.Provider value={{ dialog }}>
      {children}
      {dialogState && (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogState.title}</DialogTitle>
              {dialogState.description && (
                <DialogDescription>{dialogState.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              {renderButtons()}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DialogContext.Provider>
  );
};
