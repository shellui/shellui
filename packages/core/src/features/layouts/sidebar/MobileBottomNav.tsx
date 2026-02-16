import { Link, useLocation } from 'react-router';
import { useMemo, useEffect, useState, useRef, useLayoutEffect } from 'react';
import type { NavigationItem } from '../../config/types';
import { cn } from '../../../lib/utils';
import { Z_INDEX } from '../../../lib/z-index';
import {
  getActivePathPrefix,
  getNavPathPrefix,
  resolveLocalizedString as resolveNavLabel,
  HOMEPAGE_NAV_ITEM,
} from '../utils';
import {
  getExternalFaviconUrl,
  isAppIcon,
  BOTTOM_NAV_SLOT_WIDTH,
  BOTTOM_NAV_GAP,
  BOTTOM_NAV_PX,
  BOTTOM_NAV_MAX_SLOTS,
} from './sidebarUtils';
import { BottomNavItem } from './BottomNavItem';
import { CaretUpIcon, CaretDownIcon, HomeIcon } from './SidebarIcons';

/** Mobile bottom nav: optional Home + nav items; More only when not all fit. Dynamic from width. */
export function MobileBottomNav({
  items,
  currentLanguage,
  showHomeButton,
}: {
  items: NavigationItem[];
  currentLanguage: string;
  showHomeButton: boolean;
}) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [rowWidth, setRowWidth] = useState(0);

  const activePathPrefix = useMemo(
    () => getActivePathPrefix(location.pathname, items),
    [location.pathname, items],
  );

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
    const slotsForNav = showHomeButton ? totalSlots - 1 : totalSlots;
    const allFit = list.length <= slotsForNav;
    const maxInRow = allFit
      ? list.length
      : Math.max(0, showHomeButton ? totalSlots - 2 : totalSlots - 1);
    const row = list.slice(0, maxInRow);
    const rowPaths = new Set(row.map((i) => i.path));
    const overflow = list.filter((item) => !rowPaths.has(item.path));
    return {
      rowItems: row,
      overflowItems: overflow,
      hasMore: overflow.length > 0,
    };
  }, [items, rowWidth, showHomeButton]);

  useEffect(() => {
    setExpanded(false);
  }, [location.pathname]);

  const renderItem = (item: NavigationItem, index: number) => {
    const pathPrefix = getNavPathPrefix(item);
    const isOverlayOrExternal =
      item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external';
    const isActive = !isOverlayOrExternal && pathPrefix === activePathPrefix;
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
      <div className="flex flex-row flex-nowrap items-center justify-center gap-1 px-3 overflow-x-hidden">
        {showHomeButton && (
          <Link
            to="/"
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-md py-1.5 px-2 min-w-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              location.pathname === '/' || location.pathname === ''
                ? 'bg-sidebar-accent text-sidebar-accent-foreground [&_span]:text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground [&_span]:inherit',
            )}
            aria-label={resolveNavLabel(HOMEPAGE_NAV_ITEM.label, currentLanguage) || 'Home'}
          >
            <span className="size-4 shrink-0 flex items-center justify-center [&_svg]:text-current">
              <HomeIcon className="size-4" />
            </span>
            <span className="text-[11px] leading-tight">
              {resolveNavLabel(HOMEPAGE_NAV_ITEM.label, currentLanguage) || 'Home'}
            </span>
          </Link>
        )}
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
}
