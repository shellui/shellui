import { Link, useLocation, Outlet, useNavigate } from 'react-router';
import { useMemo, useEffect } from 'react';
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
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ModalProvider, useModal } from '../modal/ModalContext';
import { DrawerProvider, useDrawer } from '../drawer/DrawerContext';
import { SonnerProvider } from '../sonner/SonnerContext';
import { DialogProvider } from '../alertDialog/DialogContext';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';
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

// Filter navigation for sidebar: remove items with hidden, and groups that become empty
const filterNavigationForSidebar = (navigation: (NavigationItem | NavigationGroup)[]): (NavigationItem | NavigationGroup)[] => {
  if (navigation.length === 0) return [];
  return navigation
    .map((item) => {
      if ('title' in item && 'items' in item) {
        const group = item as NavigationGroup;
        const visibleItems = group.items.filter((navItem) => !navItem.hidden);
        if (visibleItems.length === 0) return null;
        return { ...group, items: visibleItems };
      }
      const navItem = item as NavigationItem;
      if (navItem.hidden) return null;
      return item;
    })
    .filter((item): item is NavigationItem | NavigationGroup => item !== null);
};

// DuckDuckGo favicon URL for a given page URL (used when openIn === 'external' and no icon is set)
const getExternalFaviconUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (!hostname) return null;
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return null;
  }
};

// Split navigation by position: start (main content) and end (footer). End is flattened to NavigationItem[].
const splitNavigationByPosition = (
  navigation: (NavigationItem | NavigationGroup)[]
): { start: (NavigationItem | NavigationGroup)[]; end: NavigationItem[] } => {
  const start: (NavigationItem | NavigationGroup)[] = [];
  const end: NavigationItem[] = [];
  for (const item of navigation) {
    const position = 'position' in item ? (item.position ?? 'start') : 'start';
    if (position === 'end') {
      if ('title' in item && 'items' in item) {
        const group = item as NavigationGroup;
        end.push(...group.items.filter((navItem) => !navItem.hidden));
      } else {
        const navItem = item as NavigationItem;
        if (!navItem.hidden) end.push(navItem);
      }
    } else {
      start.push(item);
    }
  }
  return { start, end };
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

  // Render a single nav item link or modal/drawer trigger
  const renderNavItem = (navItem: NavigationItem) => {
    const pathPrefix = `/${navItem.path}`;
    const isOverlay = navItem.openIn === 'modal' || navItem.openIn === 'drawer';
    const isExternal = navItem.openIn === 'external';
    const isActive = !isOverlay && !isExternal && (location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`));
    const itemLabel = resolveLocalizedString(navItem.label, currentLanguage);
    const faviconUrl = isExternal && !navItem.icon ? getExternalFaviconUrl(navItem.url) : null;
    const iconSrc = navItem.icon ?? faviconUrl ?? null;
    const iconEl = iconSrc ? (
      <img src={iconSrc} alt="" className={cn('h-4 w-4', 'shrink-0')} />
    ) : hasAnyIcons ? (
      <span className="h-4 w-4 shrink-0" />
    ) : null;
    const externalIcon = isExternal ? (
      <img src="/icons/external-link.svg" alt="" className="ml-auto h-4 w-4 shrink-0 opacity-70" aria-hidden />
    ) : null;
    const content = (
      <>
        {iconEl}
        <span className="truncate">{itemLabel}</span>
        {externalIcon}
      </>
    );
    const linkOrTrigger =
      navItem.openIn === 'modal' ? (
        <button type="button" onClick={() => shellui.openModal(navItem.url)} className="flex items-center gap-2 w-full cursor-pointer text-left">
          {content}
        </button>
      ) : navItem.openIn === 'drawer' ? (
        <button
          type="button"
          onClick={() => shellui.openDrawer({ url: navItem.url, position: navItem.drawerPosition })}
          className="flex items-center gap-2 w-full cursor-pointer text-left"
        >
          {content}
        </button>
      ) : navItem.openIn === 'external' ? (
        <a href={navItem.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full">
          {content}
        </a>
      ) : (
        <Link to={`/${navItem.path}`} className="flex items-center gap-2 w-full">
          {content}
        </Link>
      );
    return (
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "w-full",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        {linkOrTrigger}
      </SidebarMenuButton>
    );
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
                  {item.items.map((navItem) => (
                    <SidebarMenuItem key={navItem.path}>
                      {renderNavItem(navItem)}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        } else {
          // Render as a standalone item
          return (
            <SidebarMenu key={item.path} className="gap-0.5">
              <SidebarMenuItem>
                {renderNavItem(item)}
              </SidebarMenuItem>
            </SidebarMenu>
          );
        }
      })}
    </>
  );
};

const DefaultLayoutContent = ({ title, navigation }: DefaultLayoutProps) => {
  const navigate = useNavigate();
  const { isOpen, modalUrl, closeModal } = useModal();
  const { isOpen: isDrawerOpen, drawerUrl, position: drawerPosition, size: drawerSize, closeDrawer } = useDrawer();
  const { t } = useTranslation('common');

  const { startNav, endItems } = useMemo(() => {
    const { start, end } = splitNavigationByPosition(navigation);
    return {
      startNav: filterNavigationForSidebar(start),
      endItems: end,
    };
  }, [navigation]);

  // Flatten navigation items for finding nav items by URL
  const navigationItems = useMemo(() => flattenNavigationItems(navigation), [navigation]);

  // When opening modal, close drawer so only one overlay is visible
  useEffect(() => {
    const cleanup = shellui.addMessageListener('SHELLUI_OPEN_MODAL', () => {
      closeDrawer();
    });
    return () => cleanup();
  }, [closeDrawer]);

  // Handle SHELLUI_NAVIGATE from sub-apps: close overlay, validate URL (startsWith nav item), then navigate or toast error
  useEffect(() => {
    const cleanup = shellui.addMessageListener('SHELLUI_NAVIGATE', (data) => {
      const payload = data.payload as { url?: string };
      const rawUrl = payload?.url;
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) return;

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

      closeModal();
      closeDrawer();

      const isHomepage = pathname === '/' || pathname === '';
      const isAllowed =
        isHomepage ||
        navigationItems.some(
          (item) => pathname === `/${item.path}` || pathname.startsWith(`/${item.path}/`)
        );
      if (isAllowed) {
        navigate(pathname || '/');
      } else {
        shellui.toast({
          type: 'error',
          title: t('navigationError') ?? 'Navigation error',
          description: t('navigationNotAllowed') ?? 'This URL is not configured in the app navigation.',
        });
      }
    });
    return () => cleanup();
  }, [navigate, closeModal, closeDrawer, navigationItems, t]);

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
            <NavigationContent navigation={startNav} />
          </SidebarContent>

          {endItems.length > 0 && (
            <SidebarFooter>
              <NavigationContent navigation={endItems} />
            </SidebarFooter>
          )}
        </Sidebar>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
          <div className="absolute top-4 left-4" style={{ zIndex: Z_INDEX.SIDEBAR_TRIGGER }}>
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

      <Drawer open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()} direction={drawerPosition}>
        <DrawerContent direction={drawerPosition} size={drawerSize} className="p-0 overflow-hidden flex flex-col">
          {drawerUrl ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <ContentView url={drawerUrl} pathPrefix="settings" ignoreMessages={true} navItem={navigationItems.find(item => item.url === drawerUrl)!} />
            </div>
          ) : (
            <div className="flex-1 p-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <h3 className="font-semibold text-destructive mb-2">Error: Drawer URL is undefined</h3>
                <p className="text-sm text-muted-foreground">
                  The <code className="text-xs bg-background px-1 py-0.5 rounded">openDrawer</code> function was called without a valid URL parameter.
                  Please ensure you provide a URL when opening the drawer.
                </p>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
      <Toaster />
    </SidebarProvider>
  );
};

export const DefaultLayout = ({ title, navigation }: DefaultLayoutProps) => {
  return (
    <ModalProvider>
      <DrawerProvider>
        <SonnerProvider>
          <DialogProvider>
            <DefaultLayoutContent title={title} navigation={navigation} />
          </DialogProvider>
        </SonnerProvider>
      </DrawerProvider>
    </ModalProvider>
  );
};
