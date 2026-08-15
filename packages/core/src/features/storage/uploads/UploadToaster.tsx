import { useEffect } from 'react';
import { shellui } from '@shellui/sdk';
import { UploadToastCard } from './UploadToastCard';
import { startUploadToastDemo, UPLOAD_TOAST_DEMO_MESSAGE, UPLOAD_TOAST_ID } from './uploadQueue';
import { useUploadQueue } from './useUploadQueue';
import { Z_INDEX } from '../../../lib/z-index';

function isShellUiRoot(): boolean {
  return typeof window !== 'undefined' && window.parent === window;
}

/**
 * Custom upload toast at the outermost ShellUI window. Nested iframes never
 * render it — they post uploads / demo requests up so the root can show this
 * panel above modals and keep it while the user navigates.
 */
export function UploadToaster() {
  const isRoot = isShellUiRoot();
  const { items } = useUploadQueue();

  useEffect(() => {
    if (!isRoot) return;
    return shellui.addMessageListener(UPLOAD_TOAST_DEMO_MESSAGE, () => {
      startUploadToastDemo();
    });
  }, [isRoot]);

  if (!isRoot || items.length === 0) return null;

  return (
    <div
      id={UPLOAD_TOAST_ID}
      className="pointer-events-none fixed right-3 bottom-20 md:right-4 md:bottom-4"
      style={{ zIndex: Z_INDEX.TOAST }}
    >
      <div className="pointer-events-auto origin-bottom animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
        <UploadToastCard />
      </div>
    </div>
  );
}
