import { useMemo, useEffect, useState, Fragment, type ReactNode } from 'react';
import { Link, useLocation, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem, NavigationGroup, LocalizedString } from '../../config/types';
import {
  filterNavigationForAuthState,
  filterNavigationByViewport,
  flattenNavigationItems,
  getActivePathPrefix,
  getNavPathPrefix,
  hasLoginNavigationItem,
  resolveLocalizedString as resolveNavLabel,
  splitNavigationByPosition,
  withHomepageWhenNoRoot,
} from '../utils';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { AppBarTooltip, TooltipProvider } from '../../../components/ui/tooltip';
import { cn } from '../../../lib/utils';
import { useIsMobile } from '../../../hooks/use-mobile';
import { LoginButton } from '../../auth/components/LoginButton';
import { useAuth } from '../../auth/hooks/useAuth';
import { useSettings } from '../../settings/hooks/useSettings';
import { NavIcon } from '../sidebar/SidebarIcons';
import { getExternalFaviconUrl } from '../sidebar/sidebarUtils';
import { DesktopHistoryButtons } from '../chrome/DesktopHistoryButtons';
import { useIsTauriClient, useMacOverlayChrome, useMacTrafficLights } from '../chrome/runtime';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
} from '../chrome/constants';

interface AppBarLayoutProps {
  title?: string;
  appIcon?: string;
  logo?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

type NavSection =
  | { type: 'group'; title: LocalizedString; items: NavigationItem[] }
  | { type: 'items'; items: NavigationItem[] };

function resolveLocalizedLabel(
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string,
): string {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

function isNavigationGroup(item: NavigationItem | NavigationGroup): item is NavigationGroup {
  return 'title' in item && 'items' in item;
}

function AppsGridIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="9.75"
        y="3"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="16.5"
        y="3"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="3"
        y="9.75"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="9.75"
        y="9.75"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="16.5"
        y="9.75"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="3"
        y="16.5"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="9.75"
        y="16.5"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
      <rect
        x="16.5"
        y="16.5"
        width="4.5"
        height="4.5"
        rx="0.75"
      />
    </svg>
  );
}

function navItemIsActive(item: NavigationItem, activePathPrefix: string | null): boolean {
  const isOverlay = item.openIn === 'modal' || item.openIn === 'drawer';
  const isExternal = item.openIn === 'external';
  return !isOverlay && !isExternal && getNavPathPrefix(item) === activePathPrefix;
}

function itemIconSrc(item: NavigationItem): string | null {
  if (item.icon) return item.icon;
  if (item.openIn === 'external') return getExternalFaviconUrl(item.url);
  return null;
}

function NavItemGlyph({
  item,
  label,
  className,
  /** Rounded muted tile with a compact icon inside (app-bar launcher). */
  tiled = false,
}: {
  item: NavigationItem;
  label: string;
  className?: string;
  tiled?: boolean;
}) {
  const iconSrc = itemIconSrc(item);
  const firstLetter = label ? label.charAt(0).toUpperCase() : '?';

  if (tiled) {
    return (
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-border/60',
          className,
        )}
        aria-hidden
      >
        {iconSrc ? (
          <NavIcon
            src={iconSrc}
            className="size-5"
          />
        ) : (
          <span className="text-xs font-semibold">{firstLetter}</span>
        )}
      </span>
    );
  }

  if (iconSrc) {
    return (
      <NavIcon
        src={iconSrc}
        className={cn('size-4', className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      {firstLetter}
    </span>
  );
}

function navigateToItem(item: NavigationItem): void {
  if (item.openIn === 'modal') {
    shellui.openModal(item.url);
    return;
  }
  if (item.openIn === 'drawer') {
    shellui.openDrawer({ url: item.url, position: item.drawerPosition });
    return;
  }
  if (item.openIn === 'external') {
    window.open(item.url, '_blank', 'noopener,noreferrer');
    return;
  }
  // Link navigation handled by callers that render <Link>
}

function buildStartSections(start: (NavigationItem | NavigationGroup)[]): NavSection[] {
  const filtered: (NavigationItem | NavigationGroup)[] = [];
  for (const entry of start) {
    if (isNavigationGroup(entry)) {
      const items = entry.items.filter((i) => !i.hidden);
      if (items.length > 0) {
        filtered.push({ ...entry, items });
      }
    } else if (!entry.hidden) {
      filtered.push(entry);
    }
  }

  const flat = flattenNavigationItems(filtered);
  const ensured = withHomepageWhenNoRoot(flat.filter((i) => !i.hidden));
  const home = ensured.find((i) => i.path === '' || i.path === '/');
  const needsHome = Boolean(home && !flat.some((i) => i.path === home.path));
  const withHome: (NavigationItem | NavigationGroup)[] =
    needsHome && home ? [home, ...filtered] : filtered;

  const sections: NavSection[] = [];
  for (const entry of withHome) {
    if (isNavigationGroup(entry)) {
      sections.push({
        type: 'group',
        title: entry.title,
        items: entry.items.filter((i) => !i.hidden),
      });
      continue;
    }
    const last = sections[sections.length - 1];
    if (last?.type === 'items') {
      last.items.push(entry);
    } else {
      sections.push({ type: 'items', items: [entry] });
    }
  }
  return sections;
}

/** Resolve selected item + localized category for the current path. */
function resolveSelectedDisplay(
  sections: NavSection[],
  activePathPrefix: string | null,
  lang: string,
): { item: NavigationItem; label: string; category: string | null } | null {
  for (const section of sections) {
    const category = section.type === 'group' ? resolveLocalizedLabel(section.title, lang) : null;
    for (const item of section.items) {
      if (navItemIsActive(item, activePathPrefix)) {
        return {
          item,
          label: resolveNavLabel(item.label, lang) || item.path || 'Home',
          category,
        };
      }
    }
  }
  for (const section of sections) {
    const category = section.type === 'group' ? resolveLocalizedLabel(section.title, lang) : null;
    for (const item of section.items) {
      if (item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external') {
        continue;
      }
      return {
        item,
        label: resolveNavLabel(item.label, lang) || item.path || 'Home',
        category,
      };
    }
  }
  const firstSection = sections[0];
  const first = firstSection?.items[0];
  if (!first) return null;
  return {
    item: first,
    label: resolveNavLabel(first.label, lang) || first.path || 'Home',
    category:
      firstSection.type === 'group' ? resolveLocalizedLabel(firstSection.title, lang) : null,
  };
}

function AppBarLauncherTile({
  item,
  label,
  activePathPrefix,
  onActivate,
  onNavigate,
}: {
  item: NavigationItem;
  label: string;
  activePathPrefix: string | null;
  onActivate: (item: NavigationItem) => void;
  onNavigate: () => void;
}) {
  const isActive = navItemIsActive(item, activePathPrefix);
  const pathPrefix = getNavPathPrefix(item);
  const tileClass =
    'group flex w-[7rem] shrink-0 flex-col items-center justify-start rounded-md px-1 pt-4 pb-2 text-center focus:bg-transparent data-[highlighted]:bg-transparent';
  const body = (
    <span
      className={cn(
        'flex aspect-square w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md p-2 transition-colors',
        'hover:bg-accent/80 hover:text-accent-foreground',
        'group-data-[highlighted]:bg-accent/80 group-data-[highlighted]:text-accent-foreground',
        isActive && 'bg-accent/80 text-accent-foreground',
      )}
    >
      <NavItemGlyph
        item={item}
        label={label}
        tiled
      />
      <span className="line-clamp-2 w-full text-center text-[11px] leading-snug font-medium break-words">
        {label}
      </span>
    </span>
  );

  if (item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external') {
    return (
      <DropdownMenuItem
        className={tileClass}
        onSelect={() => onActivate(item)}
      >
        {body}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      className={tileClass}
      asChild
    >
      <Link
        to={pathPrefix}
        onClick={onNavigate}
      >
        {body}
      </Link>
    </DropdownMenuItem>
  );
}

function AppBarLauncher({
  sections,
  activePathPrefix,
  currentLanguage,
}: {
  sections: NavSection[];
  activePathPrefix: string | null;
  currentLanguage: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => resolveSelectedDisplay(sections, activePathPrefix, currentLanguage),
    [sections, activePathPrefix, currentLanguage],
  );

  const activateItem = (item: NavigationItem) => {
    if (item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external') {
      navigateToItem(item);
      setOpen(false);
    }
  };

  const renderTile = (item: NavigationItem, index: number) => {
    const label = resolveNavLabel(item.label, currentLanguage) || item.path || 'Home';
    return (
      <AppBarLauncherTile
        key={`${item.path}-${item.url}-${index}`}
        item={item}
        label={label}
        activePathPrefix={activePathPrefix}
        onActivate={activateItem}
        onNavigate={() => setOpen(false)}
      />
    );
  };

  return (
    <div
      data-shellui-no-drag=""
      className="flex min-w-0 items-center"
    >
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 max-w-[16rem] shrink gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            aria-label={t('desktopChrome.openNavigation')}
          >
            <AppsGridIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate text-xs font-medium">
              {selected?.label ?? t('desktopChrome.navigation')}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="w-max min-w-0 max-w-[calc(100vw-1.5rem)] max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height,32rem))] overflow-y-auto p-3 pt-4 md:max-w-[50vw]"
        >
          <div className="flex flex-row flex-wrap items-start gap-x-2 gap-y-4">
            {sections.map((section, sectionIndex) => {
              if (section.type === 'group') {
                const categoryLabel = resolveLocalizedLabel(section.title, currentLanguage);
                return (
                  <div
                    key={`group-${categoryLabel}-${sectionIndex}`}
                    className="relative inline-flex max-w-full flex-row flex-wrap gap-1.5 rounded-xl bg-muted/50 px-1.5 py-0 ring-1 ring-border/50"
                  >
                    <span className="pointer-events-none absolute left-2.5 top-0 z-10 -translate-y-1/2 rounded-sm bg-popover px-1.5 text-[10px] font-medium leading-none text-muted-foreground">
                      {categoryLabel}
                    </span>
                    {section.items.map((item, index) => renderTile(item, index))}
                  </div>
                );
              }

              return (
                <Fragment key={`items-${sectionIndex}`}>
                  {section.items.map((item, index) => renderTile(item, index))}
                </Fragment>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** End link: icon-only or first-letter badge with themed tooltip. */
function TopBarEndItem({
  item,
  label,
  activePathPrefix,
}: {
  item: NavigationItem;
  label: string;
  activePathPrefix: string | null;
}) {
  const pathPrefix = getNavPathPrefix(item);
  const isOverlay = item.openIn === 'modal' || item.openIn === 'drawer';
  const isExternal = item.openIn === 'external';
  const isActive = !isOverlay && !isExternal && pathPrefix === activePathPrefix;

  const faviconUrl = isExternal && !item.icon ? getExternalFaviconUrl(item.url) : null;
  const iconSrc = item.icon ?? faviconUrl ?? null;
  const firstLetter = label ? label.charAt(0).toUpperCase() : '?';

  const iconEl = iconSrc ? (
    <NavIcon
      src={iconSrc}
      className="size-4"
    />
  ) : (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground"
      aria-hidden
    >
      {firstLetter}
    </span>
  );

  const buttonClass = cn(
    'flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  );

  const wrap = (node: ReactNode) => <AppBarTooltip label={label}>{node}</AppBarTooltip>;

  if (item.openIn === 'modal') {
    return wrap(
      <button
        type="button"
        onClick={() => shellui.openModal(item.url)}
        className={buttonClass}
        aria-label={label}
      >
        {iconEl}
      </button>,
    );
  }
  if (item.openIn === 'drawer') {
    return wrap(
      <button
        type="button"
        onClick={() => shellui.openDrawer({ url: item.url, position: item.drawerPosition })}
        className={buttonClass}
        aria-label={label}
      >
        {iconEl}
      </button>,
    );
  }
  if (item.openIn === 'external') {
    return wrap(
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label={label}
      >
        {iconEl}
      </a>,
    );
  }
  return wrap(
    <Link
      to={pathPrefix}
      className={buttonClass}
      aria-label={label}
    >
      {iconEl}
    </Link>,
  );
}

export function AppBarLayout({ title, navigation }: AppBarLayoutProps) {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isTauriEnv = useIsTauriClient();
  const overlay = useMacOverlayChrome();
  const trafficLights = useMacTrafficLights();
  const currentLanguage = i18n.language || 'en';
  const hasCustomLoginNav = useMemo(() => hasLoginNavigationItem(navigation), [navigation]);
  const authAwareNavigation = useMemo(
    () =>
      filterNavigationForAuthState(navigation, isAuthenticated, settings.developerFeatures.enabled),
    [navigation, isAuthenticated, settings.developerFeatures.enabled],
  );

  const { endNavItems, navigationItems, startSections, activePathPrefix } = useMemo(() => {
    const viewportNav = filterNavigationByViewport(
      authAwareNavigation,
      isMobile ? 'mobile' : 'desktop',
    );
    const { start, end } = splitNavigationByPosition(viewportNav);
    const flat = flattenNavigationItems(authAwareNavigation);
    return {
      endNavItems: flattenNavigationItems(end).filter((i) => !i.hidden),
      navigationItems: flat,
      startSections: buildStartSections(start),
      activePathPrefix: getActivePathPrefix(location.pathname, flat),
    };
  }, [authAwareNavigation, location.pathname, isMobile]);

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

  const chromeInset = trafficLights
    ? MAC_TRAFFIC_LIGHTS_WIDTH_PX + MAC_TRAFFIC_LIGHTS_GAP_PX
    : undefined;

  const hasStartNav = startSections.some((s) => s.items.length > 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header
        className="relative z-[46] flex w-full shrink-0 items-center gap-1.5 border-b border-sidebar-border bg-sidebar text-sidebar-foreground select-none"
        style={{
          height: DESKTOP_TITLEBAR_HEIGHT_PX,
          paddingLeft: chromeInset ?? 12,
          paddingRight: 8,
        }}
        data-layout="app-bar"
        {...(trafficLights ? { 'data-shellui-drag-region': '', 'data-tauri-drag-region': '' } : {})}
      >
        {hasStartNav ? (
          <AppBarLauncher
            sections={startSections}
            activePathPrefix={activePathPrefix}
            currentLanguage={currentLanguage}
          />
        ) : null}

        {isTauriEnv ? <DesktopHistoryButtons /> : null}

        <div
          aria-hidden
          className="min-h-full min-w-[8px] flex-1"
          {...(trafficLights || overlay
            ? { 'data-shellui-drag-region': '', 'data-tauri-drag-region': '' }
            : {})}
        />

        <div
          data-shellui-no-drag=""
          className="flex shrink-0 items-center gap-0.5"
        >
          {endNavItems.length > 0 ? (
            <TooltipProvider
              delayDuration={200}
              skipDelayDuration={0}
            >
              <div className="flex items-center gap-0.5">
                {endNavItems.map((item) => (
                  <TopBarEndItem
                    key={item.path}
                    item={item}
                    label={resolveNavLabel(item.label, currentLanguage) || item.path || ''}
                    activePathPrefix={activePathPrefix}
                  />
                ))}
              </div>
            </TooltipProvider>
          ) : null}
          <LoginButton
            variant="appbar"
            hideWhenLoggedOut={hasCustomLoginNav}
          />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
