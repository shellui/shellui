import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  shellui,
  type ShellUIMessage,
  type StorageSelectMode,
  type StorageSelectRequestPayload,
  type StorageSelectResponsePayload,
} from '@shellui/sdk';
import { ContentView } from '../../components/ContentView';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Z_INDEX } from '../../lib/z-index';
import type { NavigationItem } from '../config/types';
import { useConfig } from '../config/useConfig';
import { validateAndNormalizeUrl } from '../modal/validateAndNormalizeUrl';

type PendingSelect = {
  id: string;
  from?: string[];
  url: string;
};

interface StoragePickerContextValue {
  isOpen: boolean;
  closePicker: (cancelled?: boolean) => void;
}

const StoragePickerContext = createContext<StoragePickerContextValue | undefined>(undefined);

export function useStoragePicker(): StoragePickerContextValue {
  const context = useContext(StoragePickerContext);
  if (!context) {
    throw new Error('useStoragePicker must be used within a StoragePickerProvider');
  }
  return context;
}

function buildPickerUrl(filesUrl: string, payload: StorageSelectRequestPayload): string {
  const base = filesUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    requestId: payload.id,
    mode: payload.mode,
    multiple: payload.multiple ? '1' : '0',
  });
  return `${base}/#/select?${params.toString()}`;
}

function replyToRequester(pending: PendingSelect, payload: StorageSelectResponsePayload): void {
  const message = {
    type: 'SHELLUI_SELECT_STORAGE_RESULT' as const,
    payload,
  };
  const to = pending.from?.filter(Boolean);
  if (to?.length) {
    shellui.sendMessage({ ...message, to });
    return;
  }
  if (typeof window !== 'undefined') {
    window.postMessage(message, '*');
  }
}

interface StoragePickerProviderProps {
  children: ReactNode;
}

export const StoragePickerProvider = ({ children }: StoragePickerProviderProps) => {
  const { config } = useConfig();
  const { t } = useTranslation('common');
  const [pending, setPending] = useState<PendingSelect | null>(null);
  const pendingRef = useRef<PendingSelect | null>(null);
  pendingRef.current = pending;

  const closePicker = useCallback((cancelled = true) => {
    const current = pendingRef.current;
    if (!current) return;
    if (cancelled) {
      replyToRequester(current, { id: current.id, cancelled: true });
    }
    pendingRef.current = null;
    setPending(null);
  }, []);

  const failRequest = useCallback((message: ShellUIMessage, errorMessage: string, status = 503) => {
    const payload = message.payload as StorageSelectRequestPayload | undefined;
    const id = payload?.id ?? '';
    const reply = {
      type: 'SHELLUI_SELECT_STORAGE_RESULT' as const,
      payload: {
        id,
        error: { message: errorMessage, status },
      },
    };
    const to = message.from?.filter(Boolean);
    if (to?.length) {
      shellui.sendMessage({ ...reply, to });
      return;
    }
    window.postMessage(reply, '*');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const stopOpen = shellui.addMessageListener('SHELLUI_SELECT_STORAGE', (message) => {
      const payload = message.payload as StorageSelectRequestPayload | undefined;
      if (!payload?.id) return;

      const filesUrl = config?.storage?.filesUrl?.trim();
      if (!filesUrl) {
        failRequest(
          message,
          'Storage picker is not configured. Set storage.filesUrl in shellui.config.ts.',
          503,
        );
        return;
      }

      const mode: StorageSelectMode =
        payload.mode === 'files' || payload.mode === 'any' ? payload.mode : 'folders';
      const rawUrl = buildPickerUrl(filesUrl, {
        id: payload.id,
        multiple: Boolean(payload.multiple),
        mode,
      });
      const url = validateAndNormalizeUrl(rawUrl, config);
      if (!url) {
        failRequest(message, 'Storage picker URL is not allowed.', 400);
        return;
      }

      const previous = pendingRef.current;
      if (previous) {
        replyToRequester(previous, { id: previous.id, cancelled: true });
      }

      const next: PendingSelect = {
        id: payload.id,
        from: message.from,
        url,
      };
      pendingRef.current = next;
      setPending(next);
    });

    const stopResult = shellui.addMessageListener('SHELLUI_SELECT_STORAGE_RESULT', (message) => {
      const payload = message.payload as StorageSelectResponsePayload | undefined;
      const current = pendingRef.current;
      if (!payload?.id || !current || payload.id !== current.id) return;
      // The files iframe posted the result. Forward to the original requester, then close.
      replyToRequester(current, payload);
      pendingRef.current = null;
      setPending(null);
    });

    return () => {
      stopOpen();
      stopResult();
    };
  }, [config, failRequest]);

  const pickerNavItem = {
    path: '__storage-picker',
    url: pending?.url ?? '',
    label: 'Select',
    useHashRouter: true,
  } as NavigationItem;

  return (
    <StoragePickerContext.Provider value={{ isOpen: Boolean(pending), closePicker }}>
      {children}
      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) closePicker(true);
        }}
      >
        <DialogContent
          className="flex h-[min(90vh,720px)] w-full max-w-5xl flex-col overflow-hidden p-0"
          overlayZIndex={Z_INDEX.STORAGE_PICKER_OVERLAY}
          contentZIndex={Z_INDEX.STORAGE_PICKER_CONTENT}
        >
          <DialogTitle className="sr-only">
            {t('storagePicker.title') ?? 'Select files or folders'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('storagePicker.description') ?? 'Choose items, then confirm.'}
          </DialogDescription>
          {pending ? (
            <div className="min-h-0 flex-1">
              <ContentView
                key={pending.id}
                url={pending.url}
                pathPrefix="storage-picker"
                ignoreMessages={true}
                navItem={pickerNavItem}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </StoragePickerContext.Provider>
  );
};
