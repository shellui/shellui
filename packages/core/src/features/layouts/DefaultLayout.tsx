import { Link, useLocation, Outlet } from 'react-router';
import { useMemo, useEffect, useState, useRef, useLayoutEffect } from 'react';
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
} from '../../components/ui/sidebar';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/z-index';
import {
  filterNavigationByViewport,
  filterNavigationForSidebar,
  flattenNavigationItems,
  getNavPathPrefix,
  resolveLocalizedString as resolveNavLabel,
  splitNavigationByPosition,
} from './utils';
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

const NavigationContent = ({
  navigation,
}: {
  navigation: (NavigationItem | NavigationGroup)[];
}) => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  // Helper function to resolve localized strings
  const resolveLocalizedString = (
    value: string | { en: string; fr: string; [key: string]: string },
    lang: string,
  ): string => {
    if (typeof value === 'string') {
      return value;
    }
    // Try current language first, then English as fallback
    return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
  };

  // Check if at least one navigation item has an icon
  const hasAnyIcons = useMemo(() => {
    return navigation.some((item) => {
      if ('title' in item && 'items' in item) {
        // It's a group
        return (item as NavigationGroup).items.some((navItem) => !!navItem.icon);
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
    const pathPrefix = getNavPathPrefix(navItem);
    const isOverlay = navItem.openIn === 'modal' || navItem.openIn === 'drawer';
    const isExternal = navItem.openIn === 'external';
    const isActive =
      !isOverlay &&
      !isExternal &&
      (location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`));
    const itemLabel = resolveLocalizedString(navItem.label, currentLanguage);
    const faviconUrl = isExternal && !navItem.icon ? getExternalFaviconUrl(navItem.url) : null;
    const iconSrc = navItem.icon ?? faviconUrl ?? null;
    const iconEl = iconSrc ? (
      <img
        src={iconSrc}
        alt=""
        className={cn('h-4 w-4', 'shrink-0')}
      />
    ) : hasAnyIcons ? (
      <span className="h-4 w-4 shrink-0" />
    ) : null;
    const externalIcon = isExternal ? (
      <ExternalLinkIcon className="ml-auto h-4 w-4 shrink-0 opacity-70" />
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
        <button
          type="button"
          onClick={() => shellui.openModal(navItem.url)}
          className="flex items-center gap-2 w-full cursor-pointer text-left"
        >
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
        <a
          href={navItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full"
        >
          {content}
        </a>
      ) : (
        <Link
          to={pathPrefix}
          className="flex items-center gap-2 w-full"
        >
          {content}
        </Link>
      );
    return (
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn('w-full', isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')}
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
            <SidebarGroup
              key={groupTitle}
              className="mt-0"
            >
              <SidebarGroupLabel className="mb-1">{groupTitle}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {item.items.map((navItem) => (
                    <SidebarMenuItem key={navItem.path}>{renderNavItem(navItem)}</SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        } else {
          // Render as a standalone item
          return (
            <SidebarMenu
              key={item.path}
              className="gap-0.5"
            >
              <SidebarMenuItem>{renderNavItem(item)}</SidebarMenuItem>
            </SidebarMenu>
          );
        }
      })}
    </>
  );
};

/** Reusable sidebar inner: header, main nav, footer. Used in desktop Sidebar and mobile Drawer. */
const SidebarInner = ({
  title,
  logo,
  startNav,
  endItems,
}: {
  title?: string;
  logo?: string;
  startNav: (NavigationItem | NavigationGroup)[];
  endItems: (NavigationItem | NavigationGroup)[];
}) => (
  <>
    <SidebarHeader className="border-b border-sidebar-border pb-4">
      {(title || logo) && (
        <Link
          to="/"
          className="flex items-center pl-1 pr-3 py-2 text-lg font-semibold text-sidebar-foreground hover:text-sidebar-foreground/80 transition-colors"
        >
          {logo && logo.trim() ? (
            <img
              src={logo}
              alt={title || 'Logo'}
              className="h-5 w-auto shrink-0 object-contain sidebar-logo"
            />
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
  </>
);

function resolveLocalizedLabel(
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string,
): string {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

/** Approximate width per slot (icon + label + padding) and gap for dynamic slot count. */
const BOTTOM_NAV_SLOT_WIDTH = 64;
const BOTTOM_NAV_GAP = 4;
const BOTTOM_NAV_PX = 12;
/** Max slots in the row (Home + nav + optional More) to avoid overflow/duplicated wrap. */
const BOTTOM_NAV_MAX_SLOTS = 6;

/** True when the icon is a local app icon (/icons/); external images (avatars, favicons) are shown as-is. */
const isAppIcon = (src: string) => src.startsWith('/icons/');

/** Single nav item for bottom bar: icon + label, link or action. */
const BottomNavItem = ({
  item,
  label,
  isActive,
  iconSrc,
  applyIconTheme,
}: {
  item: NavigationItem;
  label: string;
  isActive: boolean;
  iconSrc: string | null;
  applyIconTheme: boolean;
}) => {
  const pathPrefix = getNavPathPrefix(item);
  const content = (
    <span className="flex flex-col items-center justify-center gap-1 w-full min-w-0 max-w-full overflow-hidden">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className={cn(
            'size-4 shrink-0 rounded-sm object-cover',
            applyIconTheme && 'opacity-90 dark:opacity-100 dark:invert',
          )}
        />
      ) : (
        <span className="size-4 shrink-0 rounded-sm bg-muted" />
      )}
      <span className="text-[11px] leading-tight truncate w-full min-w-0 text-center block">
        {label}
      </span>
    </span>
  );
  const baseClass = cn(
    'flex flex-col items-center justify-center rounded-md py-1.5 px-2 min-w-0 max-w-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    isActive
      ? 'bg-accent text-accent-foreground [&_span]:text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground [&_span]:inherit',
  );
  if (item.openIn === 'modal') {
    return (
      <button
        type="button"
        onClick={() => shellui.openModal(item.url)}
        className={baseClass}
      >
        {content}
      </button>
    );
  }
  if (item.openIn === 'drawer') {
    return (
      <button
        type="button"
        onClick={() => shellui.openDrawer({ url: item.url, position: item.drawerPosition })}
        className={baseClass}
      >
        {content}
      </button>
    );
  }
  if (item.openIn === 'external') {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
      >
        {content}
      </a>
    );
  }
  return (
    <Link
      to={pathPrefix}
      className={baseClass}
    >
      {content}
    </Link>
  );
};

/** Inline SVG: external-link icon. Bundled so consumers don't need to serve static SVGs. */
const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('shrink-0', className)}
    aria-hidden
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line
      x1="10"
      y1="14"
      x2="21"
      y2="3"
    />
  </svg>
);

/** Caret up: expand (show second line). */
const CaretUpIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('shrink-0', className)}
    aria-hidden
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);

/** Caret down: collapse (hide second line). */
const CaretDownIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('shrink-0', className)}
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Home icon for mobile bottom bar (same as sidebar logo action). */
const HomeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('shrink-0', className)}
    aria-hidden
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

/** Mobile bottom nav: Home + nav items; More only when not all fit. Dynamic from width. */
const MobileBottomNav = ({
  items,
  currentLanguage,
}: {
  items: NavigationItem[];
  currentLanguage: string;
}) => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [rowWidth, setRowWidth] = useState(0);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setRowWidth(w);
    });
    ro.observe(el);
    setRowWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const { rowItems, overflowItems, hasMore } = useMemo(() => {
    const list = items.slice();
    const contentWidth = Math.max(0, rowWidth - BOTTOM_NAV_PX * 2);
    const slotTotal = BOTTOM_NAV_SLOT_WIDTH + BOTTOM_NAV_GAP;
    const computedSlots =
      rowWidth > 0 ? Math.floor((contentWidth + BOTTOM_NAV_GAP) / slotTotal) : 5;
    const totalSlots = Math.min(Math.max(0, computedSlots), BOTTOM_NAV_MAX_SLOTS);
    const slotsForNav = totalSlots - 1;
    const allFit = list.length <= slotsForNav;
    const maxInRow = allFit ? list.length : Math.max(0, totalSlots - 2);
    const row = list.slice(0, maxInRow);
    const rowPaths = new Set(row.map((i) => i.path));
    const overflow = list.filter((item) => !rowPaths.has(item.path));
    return {
      rowItems: row,
      overflowItems: overflow,
      hasMore: overflow.length > 0,
    };
  }, [items, rowWidth]);

  useEffect(() => {
    setExpanded(false);
  }, [location.pathname]);

  const renderItem = (item: NavigationItem, index: number) => {
    const pathPrefix = getNavPathPrefix(item);
    const isOverlayOrExternal =
      item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external';
    const isActive =
      !isOverlayOrExternal &&
      (location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`));
    const label = resolveNavLabel(item.label, currentLanguage);
    const faviconUrl =
      item.openIn === 'external' && !item.icon ? getExternalFaviconUrl(item.url) : null;
    const iconSrc = item.icon ?? faviconUrl ?? null;
    const applyIconTheme = iconSrc ? isAppIcon(iconSrc) : false;
    return (
      <BottomNavItem
        key={`${item.path}-${item.url}-${index}`}
        item={item}
        label={label}
        isActive={isActive}
        iconSrc={iconSrc}
        applyIconTheme={applyIconTheme}
      />
    );
  };

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden border-t border-sidebar-border bg-sidebar-background overflow-hidden pt-2"
      style={{
        zIndex: Z_INDEX.SIDEBAR_TRIGGER,
        paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Top row: Home + nav items + More/Less — single row, no wrap */}
      <div className="flex flex-row flex-nowrap items-center justify-center gap-1 px-3 overflow-x-hidden">
        <Link
          to="/"
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-md py-1.5 px-2 min-w-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            location.pathname === '/' || location.pathname === ''
              ? 'bg-sidebar-accent text-sidebar-accent-foreground [&_span]:text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground [&_span]:inherit',
          )}
          aria-label="Home"
        >
          <span className="size-4 shrink-0 flex items-center justify-center [&_svg]:text-current">
            <HomeIcon className="size-4" />
          </span>
          <span className="text-[11px] leading-tight">Home</span>
        </Link>
        {rowItems.map((item, i) => renderItem(item, i))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-md py-1.5 px-2 min-w-0 transition-colors cursor-pointer',
              'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            aria-expanded={expanded}
            aria-label={expanded ? 'Show less' : 'Show more'}
          >
            <span className="size-4 shrink-0 flex items-center justify-center">
              {expanded ? <CaretDownIcon className="size-4" /> : <CaretUpIcon className="size-4" />}
            </span>
            <span className="text-[11px] leading-tight">{expanded ? 'Less' : 'More'}</span>
          </button>
        )}
      </div>

      {/* Expanded: only overflow items — render list only when expanded so it clears when collapsed */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-t border-sidebar-border/50 mt-1">
            <div className="grid grid-cols-5 gap-2 justify-items-center max-w-xs mx-auto">
              {expanded ? overflowItems.map((item, i) => renderItem(item, i)) : null}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

const DefaultLayoutContent = ({ title, logo, navigation }: DefaultLayoutProps) => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  const { startNav, endItems, navigationItems, mobileNavItems } = useMemo(() => {
    const desktopNav = filterNavigationByViewport(navigation, 'desktop');
    const mobileNav = filterNavigationByViewport(navigation, 'mobile');
    const { start, end } = splitNavigationByPosition(desktopNav);
    const flat = flattenNavigationItems(desktopNav);
    const mobileFlat = flattenNavigationItems(mobileNav);
    return {
      startNav: filterNavigationForSidebar(start),
      endItems: end,
      navigationItems: flat,
      mobileNavItems: mobileFlat,
    };
  }, [navigation]);

  useEffect(() => {
    if (!title) return;
    const pathname = location.pathname.replace(/^\/+|\/+$/g, '') || '';
    const segment = pathname.split('/')[0];
    if (!segment) {
      const rootNavItem = navigationItems.find((item) => item.path === '' || item.path === '/');
      document.title = rootNavItem
        ? `${resolveLocalizedLabel(rootNavItem.label, currentLanguage)} | ${title}`
        : title;
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
            {/* Desktop sidebar: visible from md up */}
            <Sidebar className={cn('hidden md:flex shrink-0')}>
              <SidebarInner
                title={title}
                logo={logo}
                startNav={startNav}
                endItems={endItems}
              />
            </Sidebar>

            <main className="flex-1 flex flex-col overflow-hidden bg-background relative min-w-0">
              <div className="flex-1 flex flex-col overflow-auto pb-16 md:pb-0">
                <Outlet />
              </div>
            </main>
          </div>

          {/* Mobile bottom nav: visible only below md */}
          <MobileBottomNav
            items={mobileNavItems}
            currentLanguage={currentLanguage}
          />
        </OverlayShell>
      </SidebarProvider>
    </LayoutProviders>
  );
};

export const DefaultLayout = ({ title, appIcon, logo, navigation }: DefaultLayoutProps) => {
  return (
    <DefaultLayoutContent
      title={title}
      appIcon={appIcon}
      logo={logo}
      navigation={navigation}
    />
  );
};
