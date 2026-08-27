import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem } from '../config/types';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '../../components/ui/drawer';
import { ContentView } from '../../components/ContentView';
import { useModal } from '../modal/ModalContext';
import { useDrawer } from '../drawer/DrawerContext';
import { useStoragePicker } from '../storage/StoragePickerContext';
import { useNavigationItems } from '../../routes/hooks/useNavigationItems';
import { useConfig } from '../config/useConfig';
import { useIsMobile } from '../../hooks/use-mobile';
import { resolveLocalizedString } from './utils';
import { resolveSdkNavigatePath } from './resolveSdkNavigatePath';
import {
  resolveDialogSize,
  resolveDismissOptions,
  resolveDrawerSize,
} from '../overlays/overlaySize';
import { useOverlayReportedSize } from '../overlays/useOverlayReportedSize';
import { ResponsiveModal } from '../overlays/ResponsiveModal';

interface OverlayShellProps {
  children: ReactNode;
}

function OverlayUrlError({ kind }: { kind: 'modal' | 'drawer' }) {
  const label = kind === 'modal' ? 'openModal' : 'openDrawer';
  const title = kind === 'modal' ? 'Modal' : 'Drawer';
  return (
    <div className="flex-1 p-4">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <h3 className="font-semibold text-destructive mb-2">Error: {title} URL is undefined</h3>
        <p className="text-sm text-muted-foreground">
          The <code className="text-xs bg-background px-1 py-0.5 rounded">{label}</code> function
          was called without a valid URL parameter. Please ensure you provide a URL when opening the{' '}
          {kind}.
        </p>
      </div>
    </div>
  );
}

function OverlayIframe({
  url,
  navItem,
  contentSized,
  reportedHeight,
  allowInnerScroll,
}: {
  url: string;
  navItem: NavigationItem;
  contentSized: boolean;
  reportedHeight: number | null;
  /** When content-size fallback kicks in, allow the iframe area to scroll. */
  allowInnerScroll?: boolean;
}) {
  // Content-sized: iframe height tracks reported content (or a short fallback until first report).
  // Preset-sized: fill the overlay and allow inner scroll.
  const scroll = allowInnerScroll || !contentSized;
  const iframeWrapStyle: CSSProperties = contentSized
    ? {
        height: reportedHeight ?? 200,
        minHeight: reportedHeight ?? 200,
        transition: 'height 200ms ease, min-height 200ms ease',
        overflow: scroll ? 'auto' : 'hidden',
      }
    : { flex: 1, minHeight: 0, overflow: 'hidden' };

  return (
    <div
      className={contentSized ? 'w-full' : 'flex-1 min-h-0 flex flex-col'}
      style={iframeWrapStyle}
    >
      <ContentView
        url={url}
        pathPrefix="settings"
        ignoreMessages={true}
        navItem={navItem}
      />
    </div>
  );
}

/** Renders modal and drawer overlays and handles SHELLUI_OPEN_MODAL / SHELLUI_NAVIGATE. */
export const OverlayShell = ({ children }: OverlayShellProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigationItems } = useNavigationItems();
  const { config } = useConfig();
  const isMobile = useIsMobile();
  const { isOpen, modalUrl, options: modalOptions, closeModal } = useModal();
  const {
    isOpen: isDrawerOpen,
    drawerUrl,
    position: drawerPosition,
    options: drawerOptions,
    closeDrawer,
  } = useDrawer();
  const { isOpen: isPickerOpen, closePicker } = useStoragePicker();
  const { t, i18n } = useTranslation('common');
  const currentLanguage = i18n.language || 'en';

  const modalDismiss = useMemo(() => resolveDismissOptions(modalOptions), [modalOptions]);
  const drawerDismiss = useMemo(() => resolveDismissOptions(drawerOptions), [drawerOptions]);

  const dialogSize = useMemo(() => resolveDialogSize(modalOptions), [modalOptions]);
  const drawerSize = useMemo(
    () => resolveDrawerSize(drawerOptions, drawerPosition),
    [drawerOptions, drawerPosition],
  );
  // Sheet presentation for mobile — bottom drawer sizing from the same modal options.
  const sheetSize = useMemo(
    () => resolveDrawerSize({ ...modalOptions, size: modalOptions?.size ?? 'lg' }, 'bottom'),
    [modalOptions],
  );

  const modalContentSized = dialogSize.contentSized || sheetSize.contentSized;
  const { reported: modalReported, usedFallback: modalSizeFallback } = useOverlayReportedSize(
    modalContentSized,
    isOpen && !isDrawerOpen,
  );
  const { reported: drawerReported, usedFallback: drawerSizeFallback } = useOverlayReportedSize(
    drawerSize.contentSized,
    isDrawerOpen,
  );

  // Close modal and drawer when app URL changes (navigation, back button) so overlay content stays url-specific
  const locationKeyRef = useRef(location.pathname + location.search + location.hash);
  useEffect(() => {
    const currentKey = location.pathname + location.search + location.hash;
    if (locationKeyRef.current !== currentKey) {
      closeModal();
      closeDrawer();
      closePicker();
      locationKeyRef.current = currentKey;
    }
  }, [location.pathname, location.search, location.hash, closeModal, closeDrawer, closePicker]);

  useEffect(() => {
    const cleanup = shellui.addMessageListener('SHELLUI_OPEN_MODAL', () => {
      closeDrawer();
    });
    return () => cleanup();
  }, [closeDrawer]);

  useEffect(() => {
    const cleanup = shellui.addMessageListener('SHELLUI_NAVIGATE', (data) => {
      const payload = data.payload as { url?: string };
      const rawUrl = payload?.url;
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) return;

      closeModal();
      closeDrawer();

      const resolvedPath = resolveSdkNavigatePath(rawUrl, config, navigationItems);
      if (resolvedPath) {
        navigate(resolvedPath);
      } else {
        shellui.toast({
          type: 'error',
          title: t('navigationError') ?? 'Navigation error',
          description:
            t('navigationNotAllowed') ?? 'This URL is not configured in the app navigation.',
        });
      }
    });
    return () => cleanup();
  }, [navigate, closeModal, closeDrawer, config, navigationItems, t]);

  const modalNavItem = navigationItems.find((item) => item.url === modalUrl) as NavigationItem;
  const drawerNavItem = navigationItems.find((item) => item.url === drawerUrl) as NavigationItem;

  const presentation = isMobile ? 'sheet' : 'dialog';

  const modalChromeClassName =
    presentation === 'sheet' ? sheetSize.className : dialogSize.className;

  const modalChromeStyle: CSSProperties = {
    ...(presentation === 'sheet' ? sheetSize.style : dialogSize.style),
    ...(modalReported
      ? presentation === 'sheet'
        ? {
            height: modalReported.height,
            maxHeight: `min(${modalReported.height}px, 92dvh)`,
          }
        : {
            height: modalReported.height,
            maxHeight: `min(${modalReported.height}px, 92dvh)`,
            ...(modalReported.width
              ? { width: modalReported.width, maxWidth: 'min(92vw, 100%)' }
              : {}),
          }
      : presentation === 'sheet' && sheetSize.drawerSize
        ? {
            height: sheetSize.drawerSize,
            maxHeight: `min(${sheetSize.drawerSize}, 100dvh)`,
          }
        : {}),
  };

  const drawerContentStyle: CSSProperties = {
    ...drawerSize.style,
    ...(drawerReported
      ? drawerPosition === 'top' || drawerPosition === 'bottom'
        ? {
            height: drawerReported.height,
            maxHeight: `min(${drawerReported.height}px, 92dvh)`,
          }
        : {
            width: drawerReported.width ?? drawerReported.height,
            maxWidth: `min(${drawerReported.width ?? drawerReported.height}px, 92vw)`,
          }
      : {}),
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open && isPickerOpen) return;
    if (!open) {
      if (!modalDismiss.dismissible && !modalDismiss.closeOnOverlayClick) return;
      closeModal();
    }
  };

  const handleDrawerOpenChange = (open: boolean) => {
    if (!open) {
      if (!drawerDismiss.dismissible) return;
      closeDrawer();
    }
  };

  const modalTitle =
    resolveLocalizedString(modalNavItem?.label, currentLanguage) ||
    (t('modalContent') ?? 'Modal content');

  return (
    <>
      {children}

      {/*
        Single host for openModal: presentation morphs dialog ↔ sheet via CSS.
        One OverlayIframe stays mounted across breakpoint changes (no iframe reload).
      */}
      <ResponsiveModal
        open={isOpen}
        onOpenChange={handleModalOpenChange}
        presentation={presentation}
        className={modalChromeClassName}
        style={modalChromeStyle}
        title={modalTitle}
        description={t('modalContent') ?? 'Modal content'}
        showCloseButton={modalDismiss.showCloseButton}
        dismissible={modalDismiss.dismissible}
        closeOnOverlayClick={modalDismiss.closeOnOverlayClick}
        showDragHandle={modalDismiss.showDragHandle && modalDismiss.dismissible}
      >
        {modalUrl ? (
          <OverlayIframe
            url={modalUrl}
            navItem={modalNavItem}
            contentSized={modalContentSized}
            reportedHeight={modalReported?.height ?? null}
            allowInnerScroll={modalSizeFallback}
          />
        ) : (
          <OverlayUrlError kind="modal" />
        )}
      </ResponsiveModal>

      {/* Explicit drawers (any edge) — separate from responsive modal */}
      <Drawer
        open={isDrawerOpen}
        onOpenChange={handleDrawerOpenChange}
        direction={drawerPosition}
        dismissible={drawerDismiss.dismissible}
      >
        <DrawerContent
          direction={drawerPosition}
          size={
            drawerReported
              ? drawerPosition === 'top' || drawerPosition === 'bottom'
                ? `${drawerReported.height}px`
                : `${drawerReported.width ?? drawerReported.height}px`
              : drawerSize.drawerSize
          }
          style={drawerContentStyle}
          className={drawerSize.className}
          showCloseButton={drawerDismiss.showCloseButton}
          showDragHandle={drawerDismiss.showDragHandle && drawerDismiss.dismissible}
          closeOnOverlayClick={drawerDismiss.closeOnOverlayClick}
        >
          {drawerUrl ? (
            <>
              <DrawerTitle className="sr-only">
                {resolveLocalizedString(drawerNavItem?.label, currentLanguage) ||
                  (t('modalContent') ?? 'Drawer content')}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                {t('modalContent') ?? 'Drawer content'}
              </DrawerDescription>
              <OverlayIframe
                url={drawerUrl}
                navItem={drawerNavItem}
                contentSized={drawerSize.contentSized}
                reportedHeight={
                  drawerPosition === 'top' || drawerPosition === 'bottom'
                    ? (drawerReported?.height ?? null)
                    : (drawerReported?.width ?? drawerReported?.height ?? null)
                }
                allowInnerScroll={drawerSizeFallback}
              />
            </>
          ) : (
            <OverlayUrlError kind="drawer" />
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};
export default OverlayShell;
