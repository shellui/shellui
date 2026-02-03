import { Link, useLocation, Outlet } from 'react-router';
import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem, NavigationGroup } from '../config/types';
import {
  Sidebar,
  SidebarProvider,
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
import { cn } from '@/lib/utils';
import { filterNavigationForSidebar, flattenNavigationItems, splitNavigationByPosition } from './utils';
import { LayoutProviders } from './LayoutProviders';
import { OverlayShell } from './OverlayShell';

interface DefaultLayoutProps {
  title?: string;
  appIcon?: string;
  logo?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

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

function resolveLocalizedLabel(
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string
): string {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

const DefaultLayoutContent = ({ title, logo, navigation }: DefaultLayoutProps) => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  const { startNav, endItems, navigationItems } = useMemo(() => {
    const { start, end } = splitNavigationByPosition(navigation);
    return {
      startNav: filterNavigationForSidebar(start),
      endItems: end,
      navigationItems: flattenNavigationItems(navigation),
    };
  }, [navigation]);

  useEffect(() => {
    if (!title) return;
    const pathname = location.pathname.replace(/^\/+|\/+$/g, '') || '';
    const segment = pathname.split('/')[0];
    if (!segment) {
      document.title = title;
      return;
    }
    const navItem = navigationItems.find((item) => item.path === segment);
    if (navItem) {
      const label = resolveLocalizedLabel(navItem.label, currentLanguage);
      document.title = `${label} | ${title}`;
    } else {
      document.title = title;
    }
  }, [location.pathname, title, navigationItems, currentLanguage]);

  return (
    <LayoutProviders>
      <SidebarProvider>
        <OverlayShell navigationItems={navigationItems}>
          <div className="flex h-screen overflow-hidden">
            <Sidebar>
              <SidebarHeader className="border-b border-sidebar-border pb-4">
                {(title || logo) && (
                  <Link to="/" className="flex items-center pl-1 pr-3 py-2 text-lg font-semibold text-sidebar-foreground hover:text-sidebar-foreground/80 transition-colors">
                    {logo && logo.trim() ? (
                      <img src={logo} alt={title || 'Logo'} className="h-5 w-auto shrink-0 object-contain sidebar-logo" />
                    ) : title ? (
                      <span className="leading-none">{title}</span>
                    ) : null}
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

            <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
              <Outlet />
            </main>
          </div>
        </OverlayShell>
      </SidebarProvider>
    </LayoutProviders>
  );
};

export const DefaultLayout = ({ title, appIcon, logo, navigation }: DefaultLayoutProps) => {
  return <DefaultLayoutContent title={title} appIcon={appIcon} logo={logo} navigation={navigation} />;
};
