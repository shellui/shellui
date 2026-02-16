import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem } from '../config/types';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Drawer, DrawerContent } from '../../components/ui/drawer';
import { Toaster } from '../../components/ui/sonner';
import { ContentView } from '../../components/ContentView';
import { useModal } from '../modal/ModalContext';
import { useDrawer } from '../drawer/DrawerContext';
import { getNavPathPrefix, resolveLocalizedString } from './utils';

interface OverlayShellProps {
  navigationItems: NavigationItem[];
  children: ReactNode;
}

/** Renders modal, drawer and toaster overlays and handles SHELLUI_OPEN_MODAL / SHELLUI_NAVIGATE. */
export function OverlayShell({ navigationItems, children }: OverlayShellProps) {
  const navigate = useNavigate();
  const { isOpen, modalUrl, closeModal } = useModal();
  const {
    isOpen: isDrawerOpen,
    drawerUrl,
    position: drawerPosition,
    size: drawerSize,
    closeDrawer,
  } = useDrawer();
  const { t, i18n } = useTranslation('common');
  const currentLanguage = i18n.language || 'en';

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

      let pathname: string;

      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        try {
          pathname = new URL(rawUrl).pathname;
        } catch {
          pathname = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
        }
      } else {
        pathname = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
      }

      const isHomepage = pathname === '/' || pathname === '';
      const isAllowed =
        isHomepage ||
        navigationItems.some((item) => {
          const pathPrefix = getNavPathPrefix(item);
          return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
        });
      if (isAllowed) {
        navigate(pathname || '/');
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
  }, [navigate, closeModal, closeDrawer, navigationItems, t]);

  return (
    <>
      {children}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent className="max-w-4xl w-full h-[80vh] max-h-[680px] flex flex-col p-0 overflow-hidden">
          {modalUrl ? (
            <>
              <DialogTitle className="sr-only">
                {resolveLocalizedString(
                  navigationItems.find((item) => item.url === modalUrl)?.label,
                  currentLanguage,
                )}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t('modalContent') ?? 'Modal content'}
              </DialogDescription>
              <div
                className="flex-1"
                style={{ minHeight: 0 }}
              >
                <ContentView
                  url={modalUrl}
                  pathPrefix="settings"
                  ignoreMessages={true}
                  navItem={navigationItems.find((item) => item.url === modalUrl) as NavigationItem}
                />
              </div>
            </>
          ) : (
            <>
              <DialogTitle className="sr-only">Error: Modal URL is undefined</DialogTitle>
              <DialogDescription className="sr-only">
                The openModal function was called without a valid URL parameter.
              </DialogDescription>
              <div className="flex-1 p-4">
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <h3 className="font-semibold text-destructive mb-2">
                    Error: Modal URL is undefined
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The <code className="text-xs bg-background px-1 py-0.5 rounded">openModal</code>{' '}
                    function was called without a valid URL parameter. Please ensure you provide a
                    URL when opening the modal.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => !open && closeDrawer()}
        direction={drawerPosition}
      >
        <DrawerContent
          direction={drawerPosition}
          size={drawerSize}
          className="p-0 overflow-hidden flex flex-col"
        >
          {drawerUrl ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <ContentView
                url={drawerUrl}
                pathPrefix="settings"
                ignoreMessages={true}
                navItem={navigationItems.find((item) => item.url === drawerUrl) as NavigationItem}
              />
            </div>
          ) : (
            <div className="flex-1 p-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <h3 className="font-semibold text-destructive mb-2">
                  Error: Drawer URL is undefined
                </h3>
                <p className="text-sm text-muted-foreground">
                  The <code className="text-xs bg-background px-1 py-0.5 rounded">openDrawer</code>{' '}
                  function was called without a valid URL parameter. Please ensure you provide a URL
                  when opening the drawer.
                </p>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
      <Toaster />
    </>
  );
}
