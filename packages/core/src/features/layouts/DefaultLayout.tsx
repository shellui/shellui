import { Link, useLocation, Outlet } from 'react-router';
import { useMemo } from 'react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModalProvider, useModal } from '../modal/ModalContext';
import { cn } from '@/lib/utils';
import { ContentView } from '@/components/ContentView';

interface DefaultLayoutProps {
  title?: string;
  navigation: NavigationItem[];
  settingsUrl?: string;
}

const NavigationContent = ({ navigation }: { navigation: NavigationItem[] }) => {
  const location = useLocation();

  // Check if at least one navigation item has an icon
  const hasAnyIcons = useMemo(() => {
    return navigation.some(item => !!item.icon);
  }, [navigation]);


  return (
    <SidebarMenu>
      {navigation.map((item) => {
        const pathPrefix = `/${item.path}`;
        const isActive = location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`);
        
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
                {item.icon ? (
                  <img src={item.icon} alt="" className="h-4 w-4 shrink-0" />
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
  const { isOpen, modalUrl, closeModal } = useModal();

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
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0 overflow-hidden">
          {modalUrl ? (
            <div className="flex-1" style={{ minHeight: 0 }}>
              <ContentView url={modalUrl} pathPrefix="settings" ignoreMessages={true} />
            </div>
          ) : (
            <div className="flex-1 p-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <h3 className="font-semibold text-destructive mb-2">Error: Modal URL is undefined</h3>
                <p className="text-sm text-muted-foreground">
                  The <code className="text-xs bg-background px-1 py-0.5 rounded">openModal</code> function was called without a valid URL parameter. 
                  Please ensure you provide a URL when opening the modal.
                </p>
              </div>
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
