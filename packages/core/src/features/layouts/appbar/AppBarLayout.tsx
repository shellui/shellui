import {
  useMemo,
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { Link, useLocation, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type {
  NavigationItem,
  NavigationGroup,
  LocalizedString,
  ThemeAsset,
} from '../../config/types';
import { AppBrandIcon } from '../branding/AppBrandIcon';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import {
  isShellUiRootWindow,
  SafeAreaTopbarOffset,
  SafeAreaTopbarStrip,
} from '../chrome/SafeAreaTopbar';
import { useIsTauriRuntime, useMacOverlayChrome, useMacTrafficLights } from '../chrome/runtime';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  DESKTOP_TITLEBAR_PAD_TOP_PX,
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
} from '../chrome/constants';

/** App-bar chrome height — matches the Tauri / sidebar titlebar strip. */
const APP_BAR_HEIGHT_PX = DESKTOP_TITLEBAR_HEIGHT_PX;

interface AppBarLayoutProps {
  title?: string;
  appIcon?: ThemeAsset;
  logo?: ThemeAsset;
  navigation: (NavigationItem | NavigationGroup)[];
}

type NavSection =
  | { type: 'group'; title: LocalizedString; items: NavigationItem[] }
  | { type: 'items'; items: NavigationItem[] };

type NavEntry =
  | { type: 'link'; key: string; item: NavigationItem }
  | { type: 'category'; key: string; title: LocalizedString; items: NavigationItem[] };

const NAV_GAP_PX = 4;
/** Reserved width guess before More is measured; kept close to the real control. */
const MORE_FALLBACK_PX = 72;

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

function navItemIsActive(item: NavigationItem, activePathPrefix: string | null): boolean {
  const isOverlay = item.openIn === 'modal' || item.openIn === 'drawer';
  const isExternal = item.openIn === 'external';
  return !isOverlay && !isExternal && getNavPathPrefix(item) === activePathPrefix;
}

function categoryIsActive(items: NavigationItem[], activePathPrefix: string | null): boolean {
  return items.some((item) => navItemIsActive(item, activePathPrefix));
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
  }
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

function sectionsToEntries(sections: NavSection[]): NavEntry[] {
  const entries: NavEntry[] = [];
  sections.forEach((section, sectionIndex) => {
    if (section.type === 'group') {
      entries.push({
        type: 'category',
        key: `category-${sectionIndex}`,
        title: section.title,
        items: section.items,
      });
      return;
    }
    section.items.forEach((item, itemIndex) => {
      entries.push({
        type: 'link',
        key: `link-${sectionIndex}-${item.path}-${itemIndex}`,
        item,
      });
    });
  });
  return entries;
}

function CaretDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function itemIconSrc(item: NavigationItem): string | null {
  if (item.icon) return item.icon;
  if (item.openIn === 'external') return getExternalFaviconUrl(item.url);
  return null;
}

/** Compact icon (or first-letter fallback) for start-nav links. */
function AppBarItemIcon({ item, label }: { item: NavigationItem; label: string }) {
  const iconSrc = itemIconSrc(item);
  const firstLetter = label ? label.charAt(0).toUpperCase() : '?';
  if (iconSrc) {
    return (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 p-0.5"
        aria-hidden
      >
        <NavIcon
          src={iconSrc}
          className="size-3"
        />
      </span>
    );
  }
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted p-0.5 text-[9px] font-semibold leading-none text-muted-foreground"
      aria-hidden
    >
      {firstLetter}
    </span>
  );
}

const navTriggerClass = (active: boolean) =>
  cn(
    // h-7 leaves air in the 42px chrome after the 2px top pad.
    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  );

/** Text link / action used in the bar (not inside a dropdown). */
function AppBarNavLink({
  item,
  label,
  activePathPrefix,
}: {
  item: NavigationItem;
  label: string;
  activePathPrefix: string | null;
}) {
  const isActive = navItemIsActive(item, activePathPrefix);
  const pathPrefix = getNavPathPrefix(item);
  const className = navTriggerClass(isActive);
  const content = (
    <>
      <AppBarItemIcon
        item={item}
        label={label}
      />
      <span className="truncate">{label}</span>
    </>
  );

  if (item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external') {
    return (
      <button
        type="button"
        className={className}
        onClick={() => navigateToItem(item)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={pathPrefix}
      className={className}
    >
      {content}
    </Link>
  );
}

function AppBarNavMenuItem({
  item,
  label,
  activePathPrefix,
  onNavigate,
}: {
  item: NavigationItem;
  label: string;
  activePathPrefix: string | null;
  onNavigate?: () => void;
}) {
  const isActive = navItemIsActive(item, activePathPrefix);
  const pathPrefix = getNavPathPrefix(item);
  const itemClass = cn('gap-2 text-sm', isActive && 'bg-accent text-accent-foreground');
  const content = (
    <>
      <AppBarItemIcon
        item={item}
        label={label}
      />
      <span className="truncate">{label}</span>
    </>
  );

  if (item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external') {
    return (
      <DropdownMenuItem
        className={itemClass}
        onSelect={() => {
          navigateToItem(item);
          onNavigate?.();
        }}
      >
        {content}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      className={itemClass}
      asChild
    >
      <Link
        to={pathPrefix}
        onClick={onNavigate}
      >
        {content}
      </Link>
    </DropdownMenuItem>
  );
}

function AppBarNavCategory({
  title,
  items,
  activePathPrefix,
  currentLanguage,
}: {
  title: LocalizedString;
  items: NavigationItem[];
  activePathPrefix: string | null;
  currentLanguage: string;
}) {
  const [open, setOpen] = useState(false);
  const label = resolveLocalizedLabel(title, currentLanguage);
  const active = categoryIsActive(items, activePathPrefix);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(navTriggerClass(active), 'hover:bg-sidebar-accent/50')}
          aria-expanded={open}
        >
          <span className="truncate">{label}</span>
          <CaretDownIcon className="size-3 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {items.map((item, index) => (
          <AppBarNavMenuItem
            key={`${item.path}-${item.url}-${index}`}
            item={item}
            label={resolveNavLabel(item.label, currentLanguage) || item.path || 'Home'}
            activePathPrefix={activePathPrefix}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppBarNavMore({
  entries,
  activePathPrefix,
  currentLanguage,
}: {
  entries: NavEntry[];
  activePathPrefix: string | null;
  currentLanguage: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const moreActive = entries.some((entry) =>
    entry.type === 'link'
      ? navItemIsActive(entry.item, activePathPrefix)
      : categoryIsActive(entry.items, activePathPrefix),
  );

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(navTriggerClass(moreActive), 'hover:bg-sidebar-accent/50')}
          aria-label={t('desktopChrome.more')}
          aria-expanded={open}
        >
          <span>{t('desktopChrome.more')}</span>
          <CaretDownIcon className="size-3 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="min-w-[12rem]"
      >
        {entries.map((entry, entryIndex) => {
          if (entry.type === 'link') {
            return (
              <AppBarNavMenuItem
                key={entry.key}
                item={entry.item}
                label={
                  resolveNavLabel(entry.item.label, currentLanguage) || entry.item.path || 'Home'
                }
                activePathPrefix={activePathPrefix}
                onNavigate={() => setOpen(false)}
              />
            );
          }

          const categoryLabel = resolveLocalizedLabel(entry.title, currentLanguage);
          return (
            <div key={entry.key}>
              {entryIndex > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {categoryLabel}
              </DropdownMenuLabel>
              {entry.items.map((item, index) => (
                <AppBarNavMenuItem
                  key={`${item.path}-${item.url}-${index}`}
                  item={item}
                  label={resolveNavLabel(item.label, currentLanguage) || item.path || 'Home'}
                  activePathPrefix={activePathPrefix}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Lightweight width probe — same padding/type as real triggers, no dropdown portals. */
function AppBarNavMeasureChip({
  label,
  withCaret,
  withIcon,
  measureRef,
}: {
  label: string;
  withCaret?: boolean;
  withIcon?: boolean;
  measureRef: (node: HTMLElement | null) => void;
}) {
  return (
    <span
      ref={measureRef}
      className={cn(navTriggerClass(false), 'whitespace-nowrap')}
    >
      {withIcon ? (
        <span
          className="size-5 shrink-0"
          aria-hidden
        />
      ) : null}
      {label}
      {withCaret ? <CaretDownIcon className="size-3 shrink-0 opacity-70" /> : null}
    </span>
  );
}

/**
 * Horizontal start nav: inline links, category caret dropdowns, and a More overflow menu.
 */
function AppBarNav({
  sections,
  activePathPrefix,
  currentLanguage,
}: {
  sections: NavSection[];
  activePathPrefix: string | null;
  currentLanguage: string;
}) {
  const { t } = useTranslation();
  const entries = useMemo(() => sectionsToEntries(sections), [sections]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRefs = useRef<(HTMLElement | null)[]>([]);
  const moreMeasureRef = useRef<HTMLElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(entries.length);

  const setMeasureRef = useCallback((index: number, node: HTMLElement | null) => {
    measureRefs.current[index] = node;
  }, []);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container || entries.length === 0) {
      setVisibleCount(entries.length);
      return;
    }

    const available = container.clientWidth;
    const widths = entries.map((_, i) => measureRefs.current[i]?.offsetWidth ?? 0);
    if (widths.some((w) => w <= 0)) return;

    const moreWidth = moreMeasureRef.current?.offsetWidth || MORE_FALLBACK_PX;

    let total = 0;
    for (let i = 0; i < widths.length; i++) {
      total += widths[i] + (i > 0 ? NAV_GAP_PX : 0);
    }
    if (total <= available) {
      setVisibleCount(entries.length);
      return;
    }

    let used = 0;
    let count = 0;
    for (let i = 0; i < widths.length; i++) {
      const gap = count > 0 ? NAV_GAP_PX : 0;
      const nextUsed = used + gap + widths[i];
      const needed = nextUsed + NAV_GAP_PX + moreWidth;
      if (needed > available) break;
      used = nextUsed;
      count += 1;
    }
    setVisibleCount(count);
  }, [entries]);

  useLayoutEffect(() => {
    measureRefs.current = measureRefs.current.slice(0, entries.length);
    recompute();
  }, [entries, currentLanguage, t, recompute]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  const visible = entries.slice(0, visibleCount);
  const overflow = entries.slice(visibleCount);
  const showMore = overflow.length > 0;
  const moreLabel = t('desktopChrome.more');

  return (
    <div
      data-shellui-no-drag=""
      ref={containerRef}
      className="relative flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
    >
      {/* Off-screen width probes (no DropdownMenu — avoids portal noise). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -z-10 flex items-center gap-0.5 whitespace-nowrap opacity-0"
      >
        {entries.map((entry, index) => {
          if (entry.type === 'link') {
            return (
              <AppBarNavMeasureChip
                key={`measure-${entry.key}`}
                label={
                  resolveNavLabel(entry.item.label, currentLanguage) || entry.item.path || 'Home'
                }
                withIcon
                measureRef={(node) => setMeasureRef(index, node)}
              />
            );
          }
          return (
            <AppBarNavMeasureChip
              key={`measure-${entry.key}`}
              label={resolveLocalizedLabel(entry.title, currentLanguage)}
              withCaret
              measureRef={(node) => setMeasureRef(index, node)}
            />
          );
        })}
        <AppBarNavMeasureChip
          label={moreLabel}
          withCaret
          measureRef={(node) => {
            moreMeasureRef.current = node;
          }}
        />
      </div>

      {visible.map((entry) => {
        if (entry.type === 'link') {
          return (
            <AppBarNavLink
              key={entry.key}
              item={entry.item}
              label={
                resolveNavLabel(entry.item.label, currentLanguage) || entry.item.path || 'Home'
              }
              activePathPrefix={activePathPrefix}
            />
          );
        }
        return (
          <AppBarNavCategory
            key={entry.key}
            title={entry.title}
            items={entry.items}
            activePathPrefix={activePathPrefix}
            currentLanguage={currentLanguage}
          />
        );
      })}
      {showMore ? (
        <AppBarNavMore
          entries={overflow}
          activePathPrefix={activePathPrefix}
          currentLanguage={currentLanguage}
        />
      ) : null}
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
      className="size-3.5"
    />
  ) : (
    <span
      className="flex size-4 shrink-0 items-center justify-center rounded-md bg-muted text-[9px] font-semibold text-muted-foreground"
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

export function AppBarLayout({ title, appIcon, navigation }: AppBarLayoutProps) {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isTauriRuntime = useIsTauriRuntime();
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
  // Nested shell-in-iframe must not repeat the root safe-area top band.
  const showSafeAreaTopbar = isShellUiRootWindow();
  // md+: strip owns the inset; mobile pads the header into the status band.
  const headerStyle = {
    paddingLeft: chromeInset ?? 12,
    paddingRight: 8,
    ...(isMobile && showSafeAreaTopbar
      ? {
          paddingTop: `calc(var(--shellui-safe-area-top) + ${DESKTOP_TITLEBAR_PAD_TOP_PX}px)`,
          height: `calc(${APP_BAR_HEIGHT_PX}px + var(--shellui-safe-area-top))`,
        }
      : {
          height: APP_BAR_HEIGHT_PX,
          paddingTop: DESKTOP_TITLEBAR_PAD_TOP_PX,
        }),
  } as const;

  return (
    <div
      data-shellui-app-bar-layout=""
      className="flex h-full max-h-full flex-col overflow-hidden bg-background"
    >
      <SafeAreaTopbarOffset enabled={showSafeAreaTopbar} />
      <SafeAreaTopbarStrip enabled={showSafeAreaTopbar} />
      <header
        className="relative z-[46] flex w-full shrink-0 items-center gap-1.5 border-b border-sidebar-border bg-sidebar text-sidebar-foreground select-none"
        style={headerStyle}
        data-layout="app-bar"
        {...(trafficLights ? { 'data-shellui-drag-region': '', 'data-tauri-drag-region': '' } : {})}
      >
        {appIcon ? (
          <AppBrandIcon
            appIcon={appIcon}
            title={title}
            data-shellui-no-drag=""
            className="mr-1 shrink-0"
            imgClassName="app-bar-app-icon"
          />
        ) : null}

        {hasStartNav ? (
          <AppBarNav
            sections={startSections}
            activePathPrefix={activePathPrefix}
            currentLanguage={currentLanguage}
          />
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        {isTauriRuntime ? (
          <div
            data-shellui-no-drag=""
            className="shrink-0"
          >
            <DesktopHistoryButtons />
          </div>
        ) : null}

        <div
          aria-hidden
          className="min-h-full min-w-[8px] shrink-0 grow-0 basis-2"
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

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
