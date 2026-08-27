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
  DYNAMIC_DRAWER_PENDING_PX,
  DYNAMIC_OVERLAY_MEASURE_WIDTH_PX,
  DYNAMIC_OVERLAY_PENDING_PX,
  resolveDialogSize,
  resolveDismissOptions,
  resolveDrawerSize,
  isDynamicSizing,
} from '../overlays/overlaySize';
import { useOverlayReportedSize } from '../overlays/useOverlayReportedSize';
import { ResponsiveModal } from '../overlays/ResponsiveModal';
import { OverlayPendingSpinner } from '../overlays/OverlayPendingSpinner';
import { OverlayDrawerPendingBar } from '../overlays/OverlayDrawerPendingBar';

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
  reportedWidth,
  allowInnerScroll,
  pending,
  pendingFill,
  pendingChrome = 'spinner',
}: {
  url: string;
  navItem: NavigationItem;
  contentSized: boolean;
  reportedHeight: number | null;
  reportedWidth?: number | null;
  /** When content-size fallback / clamp kicks in, allow the iframe area to scroll. */
  allowInnerScroll?: boolean;
  /** Waiting for first SHELLUI_OVERLAY_SIZE — show pending chrome, keep iframe loading underneath. */
  pending?: boolean;
  /** Side drawers: fill the pending strip instead of using a square height. */
  pendingFill?: boolean;
  /** Modal: centered spinner. Drawer: full-bleed 40px loading bar. */
  pendingChrome?: 'spinner' | 'bar';
}) {
  // Content-sized: iframe tracks reported content. While pending, chrome is a square/strip
  // but the iframe lays out at a realistic width (opacity 0) so the first report matches
  // final wrap — drawers use viewport width; modals use a compact measure width.
  const scroll = allowInnerScroll || !contentSized;
  const modalPendingPx = DYNAMIC_OVERLAY_PENDING_PX;
  const drawerPendingPx = DYNAMIC_DRAWER_PENDING_PX;
  const useSquarePending = pending && !pendingFill && pendingChrome === 'spinner';
  const useDrawerBarPending = pending && pendingChrome === 'bar';
  const measureW =
    pendingChrome === 'bar'
      ? typeof window !== 'undefined'
        ? window.innerWidth
        : DYNAMIC_OVERLAY_MEASURE_WIDTH_PX
      : DYNAMIC_OVERLAY_MEASURE_WIDTH_PX;

  if (!contentSized) {
    // Fill drawer chrome so ContentView's top loading bar is visible (not a 0-height flex quirk).
    return (
      <div className="relative min-h-0 w-full flex-1">
        <div className="absolute inset-0 overflow-hidden bg-background">
          <ContentView
            url={url}
            pathPrefix="settings"
            ignoreMessages={true}
            navItem={navItem}
          />
        </div>
      </div>
    );
  }

  const iframeWrapStyle: CSSProperties = pending
    ? {
        // Hidden measure box — width must match final chrome or height reflows (tall→short)
        position: 'absolute',
        left: 0,
        top: 0,
        width: measureW,
        height: 'auto',
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }
    : {
        height: reportedHeight ?? modalPendingPx,
        minHeight: reportedHeight ?? modalPendingPx,
        width: reportedWidth ?? '100%',
        overflow: scroll ? 'auto' : 'hidden',
      };

  return (
    <div
      className={`relative w-full bg-background${useDrawerBarPending && pendingFill ? ' h-full min-h-0' : ''}`}
      style={
        useSquarePending
          ? { width: modalPendingPx, height: modalPendingPx, overflow: 'hidden' }
          : useDrawerBarPending && !pendingFill
            ? { width: '100%', height: drawerPendingPx, overflow: 'hidden' }
            : useDrawerBarPending && pendingFill
              ? { width: '100%', height: '100%', minHeight: drawerPendingPx, overflow: 'hidden' }
              : undefined
      }
      aria-busy={pending || undefined}
      aria-live={pending ? 'polite' : undefined}
    >
      {pending && pendingChrome === 'spinner' ? <OverlayPendingSpinner /> : null}
      {useDrawerBarPending ? <OverlayDrawerPendingBar /> : null}
      <div
        className={pending ? undefined : 'h-full w-full'}
        style={iframeWrapStyle}
        aria-hidden={pending || undefined}
      >
        <ContentView
          url={url}
          pathPrefix="settings"
          ignoreMessages={true}
          navItem={navItem}
        />
      </div>
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

  const modalDynamic = isDynamicSizing(modalOptions);
  const drawerDynamic = isDynamicSizing(drawerOptions);

  const dialogSize = useMemo(() => resolveDialogSize(modalOptions), [modalOptions]);
  const drawerSize = useMemo(
    () => resolveDrawerSize(drawerOptions, drawerPosition),
    [drawerOptions, drawerPosition],
  );
  // Sheet presentation for mobile — bottom drawer sizing from the same modal options.
  const sheetSize = useMemo(
    () =>
      resolveDrawerSize(
        {
          ...modalOptions,
          size: modalDynamic ? 'content' : (modalOptions?.size ?? 'lg'),
          dynamicSizing: modalDynamic || modalOptions?.dynamicSizing,
        },
        'bottom',
      ),
    [modalOptions, modalDynamic],
  );

  const modalContentSized = dialogSize.contentSized || sheetSize.contentSized || modalDynamic;
  const {
    reported: modalReported,
    usedFallback: modalSizeFallback,
    wasClamped: modalWasClamped,
  } = useOverlayReportedSize(modalContentSized, isOpen && !isDrawerOpen);
  const {
    reported: drawerReported,
    usedFallback: drawerSizeFallback,
    wasClamped: drawerWasClamped,
  } = useOverlayReportedSize(drawerSize.contentSized || drawerDynamic, isDrawerOpen);

  const modalPending = isOpen && modalContentSized && !modalReported;
  const drawerPending =
    isDrawerOpen && (drawerSize.contentSized || drawerDynamic) && !drawerReported;
  const pendingPx = DYNAMIC_OVERLAY_PENDING_PX;
  const drawerPendingPx = DYNAMIC_DRAWER_PENDING_PX;

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

  const modalChromeClassName = modalPending
    ? presentation === 'sheet'
      ? 'w-full p-0 overflow-hidden flex flex-col'
      : 'rounded-lg p-0 overflow-hidden flex flex-col !w-auto !max-w-none'
    : presentation === 'sheet'
      ? sheetSize.className
      : dialogSize.className;

  const modalChromeStyle: CSSProperties = {
    // Dynamic overlays snap to reported size — no height/width tween (avoids multi-step jumps)
    ...(modalContentSized ? { transition: 'none' } : {}),
    ...(modalPending
      ? presentation === 'sheet'
        ? {
            height: pendingPx,
            minHeight: pendingPx,
            maxHeight: pendingPx,
          }
        : {
            width: pendingPx,
            height: pendingPx,
            minWidth: pendingPx,
            minHeight: pendingPx,
            maxWidth: pendingPx,
            maxHeight: pendingPx,
          }
      : {
          ...(presentation === 'sheet' ? sheetSize.style : dialogSize.style),
          ...(modalReported
            ? presentation === 'sheet'
              ? {
                  height: modalReported.height,
                  maxHeight: `min(${modalReported.height}px, 92dvh)`,
                  ...(modalReported.width
                    ? { width: modalReported.width, maxWidth: 'min(92vw, 100%)' }
                    : {}),
                }
              : {
                  height: modalReported.height,
                  maxHeight: `min(${modalReported.height}px, 92dvh)`,
                  width: modalReported.width ?? DYNAMIC_OVERLAY_MEASURE_WIDTH_PX,
                  maxWidth: 'min(92vw, 100%)',
                }
            : presentation === 'sheet' && sheetSize.drawerSize
              ? {
                  height: sheetSize.drawerSize,
                  maxHeight: `min(${sheetSize.drawerSize}, 100dvh)`,
                }
              : {}),
        }),
  };

  const drawerContentStyle: CSSProperties = {
    ...drawerSize.style,
    ...(drawerSize.contentSized || drawerDynamic ? { transition: 'none' } : {}),
    ...(drawerPending
      ? drawerPosition === 'top' || drawerPosition === 'bottom'
        ? {
            height: drawerPendingPx,
            maxHeight: drawerPendingPx,
            minHeight: drawerPendingPx,
          }
        : {
            width: drawerPendingPx,
            maxWidth: drawerPendingPx,
            minWidth: drawerPendingPx,
          }
      : drawerReported
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
        showCloseButton={!modalPending && modalDismiss.showCloseButton}
        dismissible={modalDismiss.dismissible}
        closeOnOverlayClick={modalDismiss.closeOnOverlayClick}
        showDragHandle={!modalPending && modalDismiss.showDragHandle && modalDismiss.dismissible}
        movable={!modalPending && modalOptions?.movable !== false}
        // Dynamic height and manual resize fight each other — dynamic wins
        resizable={!modalPending && !modalDynamic && modalOptions?.resizable !== false}
      >
        {modalUrl ? (
          <OverlayIframe
            url={modalUrl}
            navItem={modalNavItem}
            contentSized={modalContentSized}
            reportedHeight={modalReported?.height ?? null}
            reportedWidth={modalReported?.width ?? null}
            allowInnerScroll={modalSizeFallback || modalWasClamped}
            pending={modalPending}
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
          open={isDrawerOpen}
          size={
            drawerReported
              ? drawerPosition === 'top' || drawerPosition === 'bottom'
                ? `${drawerReported.height}px`
                : `${drawerReported.width ?? drawerReported.height}px`
              : drawerPending
                ? `${drawerPendingPx}px`
                : drawerSize.drawerSize
          }
          style={drawerContentStyle}
          className={drawerSize.className}
          showCloseButton={!drawerPending && drawerDismiss.showCloseButton}
          showDragHandle={
            !drawerPending && drawerDismiss.showDragHandle && drawerDismiss.dismissible
          }
          closeOnOverlayClick={drawerDismiss.closeOnOverlayClick}
          resizable={
            !drawerPending && !isMobile && !drawerDynamic && drawerOptions?.resizable !== false
          }
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
                reportedWidth={
                  drawerPosition === 'left' || drawerPosition === 'right'
                    ? (drawerReported?.width ?? null)
                    : null
                }
                allowInnerScroll={drawerSizeFallback || drawerWasClamped}
                pending={drawerPending}
                pendingFill={drawerPosition === 'left' || drawerPosition === 'right'}
                pendingChrome="bar"
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
