import { useMemo, useEffect, type ReactNode } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem, NavigationGroup } from '../config/types';
import {
  flattenNavigationItems,
  getNavPathPrefix,
  resolveLocalizedString as resolveNavLabel,
  splitNavigationByPosition,
} from './utils';
import { filterNavigationByViewport } from './utils';
import { LayoutProviders } from './LayoutProviders';
import { OverlayShell } from './OverlayShell';
import { Select } from '../../components/ui/select';
import { AppBarTooltip, TooltipProvider } from '../../components/ui/tooltip';
import { cn } from '../../lib/utils';

const TOP_BAR_MAX_HEIGHT = 42;

interface AppBarLayoutProps {
  title?: string;
  appIcon?: string;
  logo?: string;
  navigation: (NavigationItem | NavigationGroup)[];
}

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

const isAppIcon = (src: string) => src.startsWith('/icons/');

function resolveLocalizedLabel(
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string,
): string {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
}

/** End link: icon-only or first-letter badge with themed tooltip. */
function TopBarEndItem({
  item,
  label,
}: {
  item: NavigationItem;
  label: string;
}) {
  const pathPrefix = getNavPathPrefix(item);
  const isOverlay = item.openIn === 'modal' || item.openIn === 'drawer';
  const isExternal = item.openIn === 'external';
  const location = useLocation();
  const isActive =
    !isOverlay &&
    !isExternal &&
    (location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`));

  const faviconUrl = isExternal && !item.icon ? getExternalFaviconUrl(item.url) : null;
  const iconSrc = item.icon ?? faviconUrl ?? null;
  const firstLetter = label ? label.charAt(0).toUpperCase() : '?';

  const iconEl = iconSrc ? (
    <img
      src={iconSrc}
      alt=""
      className={cn(
        'size-5 shrink-0 rounded-sm object-cover',
        isAppIcon(iconSrc) && 'opacity-90 dark:opacity-100 dark:invert',
      )}
    />
  ) : (
    <span
      className="size-6 shrink-0 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground"
      aria-hidden
    >
      {firstLetter}
    </span>
  );

  const buttonClass = cn(
    'flex items-center justify-center size-8 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  );

  const wrap = (node: ReactNode) => (
    <AppBarTooltip label={label}>{node}</AppBarTooltip>
  );

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
    <Link to={pathPrefix} className={buttonClass} aria-label={label}>
      {iconEl}
    </Link>,
  );
}

export function AppBarLayout({ title, logo, navigation }: AppBarLayoutProps) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = i18n.language || 'en';

  const { startNavItems, endNavItems, navigationItems } = useMemo(() => {
    const desktopNav = filterNavigationByViewport(navigation, 'desktop');
    const { start, end } = splitNavigationByPosition(desktopNav);
    return {
      startNavItems: flattenNavigationItems(start).filter((i) => !i.hidden),
      endNavItems: flattenNavigationItems(end).filter((i) => !i.hidden),
      navigationItems: flattenNavigationItems(navigation),
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

  const currentPathPrefix =
    location.pathname === '/' ? '/' : `/${location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0]}`;

  return (
    <LayoutProviders>
      <OverlayShell navigationItems={navigationItems}>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          {/* Top bar: max 42px */}
          <header
            className="flex items-center gap-3 px-3 border-b border-border bg-sidebar-background shrink-0"
            style={{ minHeight: 32, maxHeight: TOP_BAR_MAX_HEIGHT }}
            data-layout="app-bar"
          >
            {/* Logo / title (home link) */}
            <Link
              to="/"
              className="flex items-center gap-2 shrink-0 min-w-0 py-1.5 pr-2 text-sidebar-foreground hover:text-sidebar-foreground/80 transition-colors"
            >
              {logo && logo.trim() ? (
                <img
                  src={logo}
                  alt={title || 'Logo'}
                  className="h-5 w-auto max-h-6 object-contain app-bar-logo m-1.5"
                />
              ) : title ? (
                <span className="text-sm font-semibold truncate">{title}</span>
              ) : null}
            </Link>

            {/* Start links: select menu */}
            {startNavItems.length > 0 && (
              <Select
                className="h-8 max-w-[200px] text-sm leading-tight py-1.5 border-sidebar-border bg-sidebar-background"
                value={currentPathPrefix}
                onChange={(e) => {
                  const path = e.target.value;
                  if (path) {
                    navigate(path.startsWith('/') ? path : `/${path}`);
                  }
                }}
              >
                {startNavItems.map((item) => (
                  <option key={item.path || 'root'} value={getNavPathPrefix(item)}>
                    {resolveNavLabel(item.label, currentLanguage) || item.path || 'Home'}
                  </option>
                ))}
              </Select>
            )}

            <div className="flex-1 min-w-0" />

            {/* End links: icon-only or first letter + tooltip */}
            {endNavItems.length > 0 && (
              <TooltipProvider delayDuration={200} skipDelayDuration={0}>
                <div className="flex items-center gap-0.5 shrink-0">
                  {endNavItems.map((item) => (
                    <TopBarEndItem
                      key={item.path}
                      item={item}
                      label={resolveNavLabel(item.label, currentLanguage) || item.path || ''}
                    />
                  ))}
                </div>
              </TooltipProvider>
            )}
          </header>

          <main className="flex-1 flex flex-col overflow-auto min-h-0">
            <Outlet />
          </main>
        </div>
      </OverlayShell>
    </LayoutProviders>
  );
}
