import { Link, useLocation, Outlet } from 'react-router-dom';
import { useMemo, useEffect, useRef } from 'react';
import { shellui } from '@shellui/sdk';
import type { NavigationItem } from '../config/types';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModalProvider, useModal } from '../modal/ModalContext';
import { cn } from '@/lib/utils';
import { getIconComponent } from '@/components/Icon';

interface DefaultLayoutProps {
  title?: string;
  navigation: NavigationItem[];
  settingsUrl?: string;
}


const NavigationContent = ({ navigation }: { navigation: NavigationItem[] }) => {
  const location = useLocation();

  // Check if at least one navigation item has an icon
  const hasAnyIcons = useMemo(() => {
    return navigation.some(item => getIconComponent(item.icon) !== null);
  }, [navigation]);

  // Memoize icon components to prevent recreation on every render
  const iconComponents = useMemo(() => {
    const components = new Map<string, ReturnType<typeof getIconComponent>>();
    navigation.forEach(item => {
      if (item.icon) {
        components.set(item.path, getIconComponent(item.icon));
      }
    });
    return components;
  }, [navigation]);

  return (
    <SidebarMenu>
      {navigation.map((item) => {
        const pathPrefix = `/${item.path}`;
        const isActive = location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`);
        const IconComponent = iconComponents.get(item.path);
        
        return (
          <SidebarMenuItem key={item.path}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className={cn(
                "w-full",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <Link to={`/${item.path}`} className="flex items-center gap-2 w-full">
                {IconComponent ? (
                  <IconComponent className="h-4 w-4 shrink-0" />
                ) : hasAnyIcons ? (
                  <span className="h-4 w-4 shrink-0" />
                ) : null}
                <span className="truncate">{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
};

const DefaultLayoutContent = ({ title, navigation, settingsUrl }: DefaultLayoutProps) => {
  const { isOpen, modalUrl, openModal, closeModal } = useModal();
  const modalIframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for messages from the modal's iframe content and propagate to parent
  useEffect(() => {
    if (!isOpen || !modalUrl) return;

    const handleMessage = (event: MessageEvent) => {
      // Only handle SHELLUI_OPEN_MODAL messages
      if (event.data?.type !== 'SHELLUI_OPEN_MODAL') {
        return;
      }

      // When modal is open, accept SHELLUI_OPEN_MODAL messages and propagate to parent
      // This handles messages from the modal's iframe content
      // For same-origin iframes, we can verify the source matches our modal iframe
      // For cross-origin iframes, we accept the message (assuming it's from modal content)
      const isFromModalIframe = !modalIframeRef.current || 
        event.source === modalIframeRef.current.contentWindow ||
        event.source === null; // Cross-origin iframes may have null source

      if (isFromModalIframe) {
        // Propagate to parent ShellUI instance
        if (window.parent !== window) {
          console.log('posting message to parent');
          window.parent.postMessage({
            type: 'SHELLUI_OPEN_MODAL',
            payload: event.data.payload
          }, '*');
        } else {
          // We're at top level, open modal (this shouldn't happen but handle it)
          const url = event.data.payload?.url || undefined;
          openModal(url);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, modalUrl, openModal]);

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border pb-4">
            {title && (
              <Link to="/" className="text-lg font-semibold text-sidebar-foreground hover:text-sidebar-foreground/80 transition-colors">
                {title}
              </Link>
            )}
          </SidebarHeader>
          
          <SidebarContent>
            <NavigationContent navigation={navigation} />
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenuButton
              onClick={() => {
                shellui.openModal(settingsUrl);
              }}
              className="w-full cursor-pointer"
            >
              <img src="/icons/settings.svg" alt="" className="h-4 w-4 shrink-0" />
              <span className="truncate">Settings</span>
            </SidebarMenuButton>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
          <div className="absolute top-4 left-4 z-[9999]">
            <SidebarTrigger />
          </div>
          <Outlet />
        </main>
      </div>

      <Dialog open={isOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            {!modalUrl && (
              <DialogDescription>
                This is a modal.
              </DialogDescription>
            )}
          </DialogHeader>
          {modalUrl ? (
            <iframe
              ref={modalIframeRef}
              src={modalUrl}
              className="flex-1 w-full border-0 rounded-md"
              style={{ minHeight: 0 }}
              title="Modal Content"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <div className="flex-1 p-4">
              <p>This is a modal.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export const DefaultLayout = ({ title, navigation, settingsUrl }: DefaultLayoutProps) => {
  return (
    <ModalProvider>
      <DefaultLayoutContent title={title} navigation={navigation} settingsUrl={settingsUrl} />
    </ModalProvider>
  );
};
