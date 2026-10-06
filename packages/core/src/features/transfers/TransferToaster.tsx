import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { shellui } from '@shellui/sdk';
import { TransferToastCard } from './TransferToastCard';
import {
  startUploadToastDemo,
  TRANSFER_TOAST_ID,
  UPLOAD_TOAST_DEMO_MESSAGE,
} from './transferQueue';
import { useTransferQueue } from './useTransferQueue';
import { Z_INDEX } from '../../lib/z-index';

function isShellUiRoot(): boolean {
  return typeof window !== 'undefined' && window.parent === window;
}

/**
 * Transfer progress toast at the outermost Shellui window (uploads + AI downloads).
 * Nested iframes never render it — they post work up so the root can show this
 * panel above modals and keep it while the user navigates.
 */
export function TransferToaster() {
  const isRoot = isShellUiRoot();
  const { items } = useTransferQueue();

  useEffect(() => {
    if (!isRoot) return;
    return shellui.addMessageListener(UPLOAD_TOAST_DEMO_MESSAGE, () => {
      startUploadToastDemo();
    });
  }, [isRoot]);

  if (!isRoot || items.length === 0) return null;

  return createPortal(
    <div
      id={TRANSFER_TOAST_ID}
      className="pointer-events-none fixed right-[max(0.75rem,env(safe-area-inset-right,0px))] bottom-[max(5rem,calc(5rem+env(safe-area-inset-bottom,0px)))] md:right-[max(1rem,env(safe-area-inset-right,0px))] md:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]"
      style={{ zIndex: Z_INDEX.TOAST }}
    >
      <div className="pointer-events-auto origin-bottom animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
        <TransferToastCard />
      </div>
    </div>,
    document.body,
  );
}

/** @deprecated Prefer TransferToaster — same component. */
export const UploadToaster = TransferToaster;
