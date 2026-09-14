import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem } from '../../config/types';
import {
  flattenNavigationItems,
  getActivePathPrefix,
  getNavPathPrefix,
  resolveLocalizedString,
} from '../utils';
import { getExternalFaviconUrl } from '../sidebar/sidebarUtils';
import { NavIcon } from '../sidebar/SidebarIcons';
import { LoginButton } from '../../auth/components/LoginButton';
import { cn } from '../../../lib/utils';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_DOCK_SIDE_INSET,
  FLOATING_FAB_NAV_GAP,
  FLOATING_MAX_TAB_SLOTS,
  FLOATING_MAX_TAB_SLOTS_WITH_FAB,
  FLOATING_MIN_TAB_SLOT_WIDTH,
  FLOATING_TAB_BAR_HEIGHT,
  floatingTabBarBottomPadCss,
} from './computeFloatingInsets';
import type { ShellViewport } from '../../../hooks/use-viewport';
import { useChromeActionsSnapshot } from '../../chromeActions/ChromeActionsProvider';
import { SHELL_DEVELOP_CHROME_ACTIONS_FRAME } from '../../chromeActions/chromeActionsStore';
import { CHROME_ACTIONS_FAB_SIZE_FLOATING } from '../../chromeActions/computeActionInsets';
import { MoreHorizontalIcon } from '../../chromeActions/ChromeActionIcons';

const MORE_TAB_KEY = '__more__';

function itemIconSrc(item: NavigationItem): string | null {
  if (item.icon) return item.icon;
  if (item.openIn === 'external') return getExternalFaviconUrl(item.url);
  return null;
}

function TabGlyph({ item, label }: { item: NavigationItem; label: string }) {
  const iconSrc = itemIconSrc(item);
  if (iconSrc) {
    return (
      <NavIcon
        src={iconSrc}
        className="size-5"
      />
    );
  }
  return (
    <span className="flex size-5 items-center justify-center text-xs font-semibold leading-none">
      {label.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function itemKey(item: NavigationItem): string {
  return `${item.path}-${item.url}`;
}

/** True when the main frame has a primary FAB (corner) — reserve space in the nav. */
function useMainHasPrimaryFab(): boolean {
  const all = useChromeActionsSnapshot();
  return useMemo(() => {
    for (const actions of all) {
      if (!actions.primary) continue;
      if (actions.frameUuid === SHELL_DEVELOP_CHROME_ACTIONS_FRAME) continue;
      for (const [uuid, iframe] of shellui.frameRegistry.getAllIframes()) {
        if (uuid !== actions.frameUuid || !iframe.isConnected) continue;
        if (iframe.dataset.shelluiFrame === 'overlay') continue;
        if (iframe.closest('[data-shellui-windows-layout]')) continue;
        return true;
      }
    }
    return false;
  }, [all]);
}

const tabTriggerClass =
  'h-auto min-w-0 flex-1 basis-0 flex-col gap-0.5 px-2 py-1.5 text-[11px] font-medium leading-tight text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none';

/**
 * Floating phone/tablet bottom nav: full-width shadcn Tabs with equal slots.
 * Primary FAB stays in the bottom-right corner; the bar shrinks to clear it.
 * Visible tab count adapts to available width.
 */
export function FloatingBottomDock({
  items,
  endItems = [],
  showAuthButton = false,
  chromeVisible,
  viewport,
}: {
  items: NavigationItem[];
  endItems?: NavigationItem[];
  showAuthButton?: boolean;
  chromeVisible: boolean;
  viewport: ShellViewport;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation('settings');
  const lang = i18n.language || 'en';
  const [moreOpen, setMoreOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const hasPrimaryFab = useMainHasPrimaryFab();
  const slotCap = hasPrimaryFab ? FLOATING_MAX_TAB_SLOTS_WITH_FAB : FLOATING_MAX_TAB_SLOTS;
  const [maxSlots, setMaxSlots] = useState(slotCap);

  const flat = useMemo(() => flattenNavigationItems(items), [items]);

  // Measure how many equal-width slots fit; tablet float uses a fixed cap.
  useLayoutEffect(() => {
    if (viewport !== 'mobile') {
      setMaxSlots(slotCap);
      return;
    }

    const el = listRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const fitted = Math.min(
        slotCap,
        Math.max(2, Math.floor(width / FLOATING_MIN_TAB_SLOT_WIDTH)),
      );
      setMaxSlots((prev) => (prev === fitted ? prev : fitted));
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [hasPrimaryFab, viewport, slotCap]);

  const needsMoreChrome = endItems.length > 0 || showAuthButton;
  // Fit as many equal slots as width allows; reserve one for More when needed.
  const showMoreFinal = needsMoreChrome || flat.length > maxSlots;
  const primaryCap = showMoreFinal ? Math.max(1, maxSlots - 1) : maxSlots;
  const primary = useMemo(() => flat.slice(0, primaryCap), [flat, primaryCap]);
  const moreOverflowItems = useMemo(() => flat.slice(primaryCap), [flat, primaryCap]);
  const moreEndItems = endItems;
  const moreItems = useMemo(
    () => [...moreOverflowItems, ...moreEndItems],
    [moreOverflowItems, moreEndItems],
  );

  const activePathPrefix = useMemo(
    () => getActivePathPrefix(location.pathname, [...flat, ...endItems]),
    [location.pathname, flat, endItems],
  );

  const moreActive = useMemo(
    () =>
      moreItems.some((item) => {
        if (item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external') {
          return false;
        }
        return getNavPathPrefix(item) === activePathPrefix;
      }),
    [moreItems, activePathPrefix],
  );

  const activeTabKey = useMemo(() => {
    if (moreActive || moreOpen) return MORE_TAB_KEY;
    const active = primary.find((item) => {
      if (item.openIn === 'modal' || item.openIn === 'drawer' || item.openIn === 'external') {
        return false;
      }
      return getNavPathPrefix(item) === activePathPrefix;
    });
    return active ? itemKey(active) : primary[0] ? itemKey(primary[0]) : MORE_TAB_KEY;
  }, [moreActive, moreOpen, primary, activePathPrefix]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!chromeVisible) setMoreOpen(false);
  }, [chromeVisible]);

  const activateItem = (navItem: NavigationItem) => {
    setMoreOpen(false);
    if (navItem.openIn === 'modal') {
      shellui.openModal(navItem.url);
      return;
    }
    if (navItem.openIn === 'drawer') {
      shellui.openDrawer({
        url: navItem.url,
        position: navItem.drawerPosition || 'right',
      });
      return;
    }
    if (navItem.openIn === 'external') {
      window.open(navItem.url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(getNavPathPrefix(navItem));
  };

  const onTabChange = (value: string) => {
    setMoreOpen(false);
    const navItem = primary.find((item) => itemKey(item) === value);
    if (navItem) activateItem(navItem);
  };

  const bottomPad = floatingTabBarBottomPadCss(viewport);

  // Phone: full-width bar clears the corner FAB. Tablet+: bar floats bottom-left;
  // FAB stays bottom-right so they don’t share a row.
  const floatStart = viewport !== 'mobile';
  // Reserve FAB width + a tight gap. Right pad matches FAB edge (no extra side
  // inset) so we don’t waste space between bar and FAB on iPhone.
  const fabReserve =
    !floatStart && hasPrimaryFab ? CHROME_ACTIONS_FAB_SIZE_FLOATING + FLOATING_FAB_NAV_GAP : 0;
  const rightPad = floatStart
    ? undefined
    : hasPrimaryFab
      ? `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-right, 0px))`
      : `calc(${FLOATING_CHROME_MARGIN + FLOATING_DOCK_SIDE_INSET}px + var(--shellui-safe-area-right, 0px))`;

  return (
    <div
      data-shellui-floating-dock="bottom"
      data-chrome-visible={chromeVisible ? 'true' : 'false'}
      data-has-fab={hasPrimaryFab ? 'true' : 'false'}
      data-dock-align={floatStart ? 'start' : 'stretch'}
      className={cn(
        'pointer-events-none absolute bottom-0 z-[45] flex',
        floatStart ? 'left-0' : 'inset-x-0',
      )}
      style={{
        paddingLeft: `calc(${FLOATING_CHROME_MARGIN + FLOATING_DOCK_SIDE_INSET}px + var(--shellui-safe-area-left, 0px))`,
        paddingRight: rightPad,
        paddingBottom: bottomPad,
      }}
    >
      <div
        data-shellui-floating-dock-row=""
        className={cn('pointer-events-auto min-w-0', floatStart ? 'w-auto max-w-md' : 'flex-1')}
        style={{
          height: FLOATING_TAB_BAR_HEIGHT,
          marginRight: fabReserve,
          transitionProperty: 'margin-right',
          transitionDuration: '380ms',
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <Tabs
          value={activeTabKey}
          onValueChange={onTabChange}
          className={cn('h-full min-w-0', floatStart ? 'w-auto' : 'w-full')}
        >
          <TabsList
            ref={listRef}
            data-shellui-floating-dock-list=""
            aria-label={t('develop.layout.floating', { defaultValue: 'Floating' })}
            className={cn(
              'flex h-full min-w-0 gap-1 border border-border/60 bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur-md',
              floatStart ? 'w-auto' : 'w-full',
            )}
            style={{
              height: FLOATING_TAB_BAR_HEIGHT,
              ...(floatStart
                ? {
                    width: `${(primary.length + (showMoreFinal ? 1 : 0)) * FLOATING_MIN_TAB_SLOT_WIDTH}px`,
                  }
                : {}),
            }}
          >
            {primary.map((navItem) => {
              const label = resolveLocalizedString(navItem.label, lang);
              const key = itemKey(navItem);
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  data-shellui-floating-dock-tab=""
                  className={tabTriggerClass}
                >
                  <TabGlyph
                    item={navItem}
                    label={label}
                  />
                  <span className="w-full truncate text-center">{label}</span>
                </TabsTrigger>
              );
            })}
            {showMoreFinal ? (
              <TabsTrigger
                value={MORE_TAB_KEY}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
              />
            ) : null}
            {showMoreFinal ? (
              <DropdownMenu
                open={moreOpen}
                onOpenChange={setMoreOpen}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTabKey === MORE_TAB_KEY}
                    data-state={activeTabKey === MORE_TAB_KEY ? 'active' : 'inactive'}
                    data-shellui-floating-dock-tab=""
                    className={cn(
                      'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                      tabTriggerClass,
                    )}
                  >
                    <MoreHorizontalIcon className="size-5" />
                    <span className="w-full truncate text-center">
                      {t('develop.layout.more', { defaultValue: 'More' })}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="end"
                  sideOffset={10}
                  className="min-w-[12rem]"
                >
                  {moreOverflowItems.map((item) => {
                    const label = resolveLocalizedString(item.label, lang);
                    const pathPrefix = getNavPathPrefix(item);
                    const isActive =
                      item.openIn !== 'modal' &&
                      item.openIn !== 'drawer' &&
                      item.openIn !== 'external' &&
                      pathPrefix === activePathPrefix;
                    return (
                      <DropdownMenuItem
                        key={itemKey(item)}
                        className={cn(isActive && 'bg-accent font-medium')}
                        onSelect={() => activateItem(item)}
                      >
                        <TabGlyph
                          item={item}
                          label={label}
                        />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  {moreOverflowItems.length > 0 && (moreEndItems.length > 0 || showAuthButton) ? (
                    <DropdownMenuSeparator />
                  ) : null}
                  {moreEndItems.map((item) => {
                    const label = resolveLocalizedString(item.label, lang);
                    return (
                      <DropdownMenuItem
                        key={itemKey(item)}
                        onSelect={() => activateItem(item)}
                      >
                        <TabGlyph
                          item={item}
                          label={label}
                        />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  {showAuthButton ? (
                    <>
                      {moreEndItems.length > 0 || moreOverflowItems.length > 0 ? (
                        <DropdownMenuSeparator />
                      ) : null}
                      <div className="px-1 py-1">
                        <LoginButton variant="sidebar" />
                      </div>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
