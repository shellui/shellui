import { Link, useLocation, Outlet } from 'react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem, NavigationGroup } from '../config/types';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ModalProvider, useModal } from '../modal/ModalContext';
import { SonnerProvider } from '../sonner/SonnerContext';
import { DialogProvider } from '../alertDialog/DialogContext';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { ContentView } from '@/components/ContentView';

interface DefaultLayoutProps {
  title?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

// Helper function to flatten navigation items from groups or flat array
const flattenNavigationItems = (navigation: (NavigationItem | NavigationGroup)[]): NavigationItem[] => {
  if (navigation.length === 0) {
    return [];
  }
  
  return navigation.flatMap(item => {
    // Check if item is a group
    if ('title' in item && 'items' in item) {
      return (item as NavigationGroup).items;
    }
    // It's a standalone NavigationItem
    return item as NavigationItem;
  });
};

const NavigationContent = ({ navigation }: { navigation: (NavigationItem | NavigationGroup)[] }) => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';
  
  // Helper function to resolve localized strings
  const resolveLocalizedString = (
    value: string | { en: string; fr: string; [key: string]: string },
    lang: string
  ): string => {
    if (typeof value === 'string') {
      return value;
    }
    // Try current language first, then English as fallback
    return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
  };

  // Check if at least one navigation item has an icon
  const hasAnyIcons = useMemo(() => {
    return navigation.some(item => {
      if ('title' in item && 'items' in item) {
        // It's a group
        return (item as NavigationGroup).items.some(navItem => !!navItem.icon);
      }
      // It's a standalone item
      return !!(item as NavigationItem).icon;
    });
  }, [navigation]);

  // Helper to check if an item is a group
  const isGroup = (item: NavigationItem | NavigationGroup): item is NavigationGroup => {
    return 'title' in item && 'items' in item;
  };

  // Render navigation items - handle both groups and standalone items
  return (
    <>
      {navigation.map((item) => {
        if (isGroup(item)) {
          // Render as a group
          const groupTitle = resolveLocalizedString(item.title, currentLanguage);
          return (
            <SidebarGroup key={groupTitle} className="mt-0">
              <SidebarGroupLabel className="mb-1">{groupTitle}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {item.items.map((navItem) => {
                    const pathPrefix = `/${navItem.path}`;
                    const isActive = location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`);
                    const itemLabel = resolveLocalizedString(navItem.label, currentLanguage);

                    return (
                      <SidebarMenuItem key={navItem.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "w-full",
                            isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                        >
                          <Link to={`/${navItem.path}`} className="flex items-center gap-2 w-full">
                            {navItem.icon ? (
                              <img src={navItem.icon} alt="" className="h-4 w-4 shrink-0" />
                            ) : hasAnyIcons ? (
                              <span className="h-4 w-4 shrink-0" />
                            ) : null}
                            <span className="truncate">{itemLabel}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        } else {
          // Render as a standalone item
          const pathPrefix = `/${item.path}`;
          const isActive = location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`);
          const itemLabel = resolveLocalizedString(item.label, currentLanguage);

          return (
            <SidebarMenu key={item.path} className="gap-0.5">
              <SidebarMenuItem>
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
                    <span className="truncate">{itemLabel}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          );
        }
      })}
    </>
  );
};

const DefaultLayoutContent = ({ title, navigation }: DefaultLayoutProps) => {
  const { isOpen, modalUrl, closeModal } = useModal();
  const { t } = useTranslation('common');
  
  // Flatten navigation items for finding nav items by URL
  const navigationItems = useMemo(() => flattenNavigationItems(navigation), [navigation]);

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

          <SidebarContent className="gap-1">
            <NavigationContent navigation={navigation} />
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenuButton
              onClick={() => {
                shellui.openModal("/__settings");
              }}
              className="w-full cursor-pointer"
            >
              <img src="/icons/settings.svg" alt="" className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('settings')}</span>
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
        <DialogContent className="max-w-4xl w-full h-[80vh] max-h-[680px] flex flex-col p-0 overflow-hidden">
          {modalUrl ? (
            <div className="flex-1" style={{ minHeight: 0 }}>
              <ContentView url={modalUrl} pathPrefix="settings" ignoreMessages={true} navItem={navigationItems.find(item => item.url === modalUrl)!} />
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
      <Toaster />
    </SidebarProvider>
  );
};

export const DefaultLayout = ({ title, navigation }: DefaultLayoutProps) => {
  return (
    <ModalProvider>
      <SonnerProvider>
        <DialogProvider>
          <DefaultLayoutContent title={title} navigation={navigation} />
        </DialogProvider>
      </SonnerProvider>
    </ModalProvider>
  );
};
