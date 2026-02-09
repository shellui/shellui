import { shellui, type ShellUIMessage, type DialogOptions } from '@shellui/sdk';
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '../../components/ui/button';
import { Z_INDEX } from '../../lib/z-index';

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
  AlertDialogOverlay,
  AlertDialogPortal,
} from '../../components/ui/alert-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

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
    <line
      x1="10"
      x2="10"
      y1="11"
      y2="17"
    />
    <line
      x1="14"
      x2="14"
      y1="11"
      y2="17"
    />
  </svg>
);

/** Cookie icon for cookie consent */
const CookieIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    fill="currentColor"
    className={className}
  >
    <path d="M164.49 163.51a12 12 0 1 1-17 0a12 12 0 0 1 17 0m-81-8a12 12 0 1 0 17 0a12 12 0 0 0-16.98 0Zm9-39a12 12 0 1 0-17 0a12 12 0 0 0 17-.02Zm48-1a12 12 0 1 0 0 17a12 12 0 0 0 0-17M232 128A104 104 0 1 1 128 24a8 8 0 0 1 8 8a40 40 0 0 0 40 40a8 8 0 0 1 8 8a40 40 0 0 0 40 40a8 8 0 0 1 8 8m-16.31 7.39A56.13 56.13 0 0 1 168.5 87.5a56.13 56.13 0 0 1-47.89-47.19a88 88 0 1 0 95.08 95.08" />
  </svg>
);

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

interface DialogState extends Omit<DialogOptions, 'onOk' | 'onCancel' | 'icon'> {
  id: string;
  mode: DialogOptions['mode'];
  from?: string[];
  iconType?: 'cookie';
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

  const handleOpenChange = useCallback(
    (open: boolean) => {
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
        } else if (dialogState.id) {
          // Dialog opened from root window - trigger callback directly
          shellui.callbackRegistry.triggerCancel(dialogState.id);
          shellui.callbackRegistry.clear(dialogState.id);
        }
        // Unmount after exit animation finishes
        scheduleUnmount();
      }
    },
    [dialogState, scheduleUnmount],
  );

  const handleOk = useCallback(() => {
    if (dialogState?.from && dialogState.from.length > 0) {
      shellui.sendMessage({
        type: 'SHELLUI_DIALOG_OK',
        payload: { id: dialogState.id },
        to: dialogState.from,
      });
    } else if (dialogState?.id) {
      // Dialog opened from root window - trigger callback directly
      shellui.callbackRegistry.triggerAction(dialogState.id);
      shellui.callbackRegistry.clear(dialogState.id);
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
    } else if (dialogState?.id) {
      // Dialog opened from root window - trigger callback directly
      shellui.callbackRegistry.triggerCancel(dialogState.id);
      shellui.callbackRegistry.clear(dialogState.id);
    }
    setIsOpen(false);
    scheduleUnmount();
  }, [dialogState, scheduleUnmount]);

  const handleSecondary = useCallback(() => {
    if (dialogState?.from && dialogState.from.length > 0) {
      shellui.sendMessage({
        type: 'SHELLUI_DIALOG_SECONDARY',
        payload: { id: dialogState.id },
        to: dialogState.from,
      });
    } else if (dialogState?.id) {
      // Dialog opened from root window - trigger callback directly
      shellui.callbackRegistry.triggerSecondary(dialogState.id);
      shellui.callbackRegistry.clear(dialogState.id);
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

    const dialogId = options.id || `dialog-${Date.now()}-${Math.random()}`;

    // Register callbacks for direct calls (not from iframe)
    if (options.onOk || options.onCancel || options.secondaryButton?.onClick) {
      shellui.callbackRegistry.register(dialogId, {
        action: options.onOk,
        cancel: options.onCancel,
        secondary: options.secondaryButton?.onClick,
      });
    }

    setDialogState({
      id: dialogId,
      title: options.title,
      description: options.description,
      mode: options.mode || 'ok',
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
      size: options.size,
      position: options.position,
      secondaryButton: options.secondaryButton,
      iconType: options.icon === 'cookie' ? 'cookie' : undefined,
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
        position: payload.position,
        secondaryButton: payload.secondaryButton,
        iconType: payload.icon === 'cookie' ? 'cookie' : undefined,
        from: data.from,
      });
      setIsOpen(true);
    });

    const cleanupDialogUpdate = shellui.addMessageListener(
      'SHELLUI_DIALOG_UPDATE',
      (data: ShellUIMessage) => {
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
          position: payload.position,
          secondaryButton: payload.secondaryButton,
          iconType: payload.icon === 'cookie' ? 'cookie' : undefined,
          from: data.from,
        });
        setIsOpen(true);
      },
    );

    return () => {
      cleanupDialog();
      cleanupDialogUpdate();
      if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    };
  }, []);

  const renderButtons = () => {
    if (!dialogState) return null;

    const { mode, okLabel, cancelLabel, secondaryButton } = dialogState;

    // Cookie consent layout: secondary button on left, primary buttons on right
    if (secondaryButton && dialogState.position === 'bottom-left') {
      return (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSecondary}
          >
            {secondaryButton.label}
          </Button>
          <div className="flex gap-2">
            {mode === 'okCancel' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
              >
                {cancelLabel || 'Cancel'}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleOk}
            >
              {okLabel || 'OK'}
            </Button>
          </div>
        </>
      );
    }

    switch (mode) {
      case 'ok':
        return <AlertDialogAction onClick={handleOk}>{okLabel || 'OK'}</AlertDialogAction>;

      case 'okCancel':
        return (
          <>
            <AlertDialogCancel
              variant="outline"
              onClick={handleCancel}
            >
              {cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOk}>{okLabel || 'OK'}</AlertDialogAction>
          </>
        );

      case 'delete':
        return (
          <>
            <AlertDialogCancel
              variant="outline"
              onClick={handleCancel}
            >
              {cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleOk}
            >
              {okLabel || 'Delete'}
            </AlertDialogAction>
          </>
        );

      case 'confirm':
        return (
          <>
            <AlertDialogCancel
              variant="outline"
              onClick={handleCancel}
            >
              {cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOk}>{okLabel || 'Confirm'}</AlertDialogAction>
          </>
        );

      case 'onlyCancel':
        return (
          <AlertDialogCancel
            variant="outline"
            onClick={handleCancel}
          >
            {cancelLabel || 'Cancel'}
          </AlertDialogCancel>
        );

      default:
        return <AlertDialogAction onClick={handleOk}>{okLabel || 'OK'}</AlertDialogAction>;
    }
  };

  // Render cookie consent dialog with custom layout
  const renderCookieConsentDialog = () => {
    if (!dialogState || dialogState.position !== 'bottom-left') return null;

    return (
      <AlertDialog
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <AlertDialogPortal>
          <AlertDialogOverlay style={{ zIndex: Z_INDEX.COOKIE_CONSENT_OVERLAY }} />
          <AlertDialogPrimitive.Content
            className="fixed w-[calc(100%-32px)] max-w-[520px] rounded-xl border border-border bg-background text-foreground shadow-lg sm:w-full"
            style={{
              bottom: 16,
              left: 16,
              zIndex: Z_INDEX.COOKIE_CONSENT_CONTENT,
              backgroundColor: 'hsl(var(--background))',
              top: 'auto',
              right: 'auto',
              transform: 'none',
            }}
            data-dialog-content
            data-cookie-consent
          >
            <div className="flex items-start gap-4 p-6 sm:gap-5 sm:p-7">
              {dialogState.iconType === 'cookie' && (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                  aria-hidden
                >
                  <CookieIcon className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <AlertDialogTitle className="text-base font-semibold leading-tight">
                  {dialogState.title}
                </AlertDialogTitle>
                {dialogState.description && (
                  <AlertDialogDescription className="text-sm leading-relaxed">
                    {dialogState.description}
                  </AlertDialogDescription>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-muted/50 px-6 py-4 sm:px-7">
              {renderButtons()}
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPortal>
      </AlertDialog>
    );
  };

  return (
    <DialogContext.Provider value={{ dialog }}>
      {children}
      {dialogState && (
        <>
          {dialogState.position === 'bottom-left' ? (
            renderCookieConsentDialog()
          ) : (
            <AlertDialog
              open={isOpen}
              onOpenChange={handleOpenChange}
            >
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
                <AlertDialogFooter>{renderButtons()}</AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      )}
    </DialogContext.Provider>
  );
};
