import { Link, useLocation } from 'react-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_MAX_TAB_SLOTS,
  FLOATING_TAB_BAR_HEIGHT,
} from './computeFloatingInsets';
import type { ShellViewport } from '../../../hooks/use-viewport';
import { FloatingTabIndicator } from './FloatingTabIndicator';

type TabPlacement = 'bottom' | 'top';

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
        className="size-6"
      />
    );
  }
  return (
    <span className="flex size-6 items-center justify-center text-[13px] font-semibold leading-none">
      {label.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function itemKey(item: NavigationItem): string {
  return `${item.path}-${item.url}`;
}

const tabClassName =
  'shellui-floating-tab relative z-[1] flex h-full min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1.5 py-1 text-[10px] font-medium transition-colors duration-200';

/** Floating glass tab bar — bottom-centered on phone and tablet. */
export function FloatingTabBar({
  items,
  endItems = [],
  showAuthButton = false,
  placement,
  chromeVisible,
  viewport,
}: {
  items: NavigationItem[];
  /** `position: 'end'` links (settings, login, …) — shown in the More sheet. */
  endItems?: NavigationItem[];
  /** Account / login control when the login nav item is hidden (logged in). */
  showAuthButton?: boolean;
  placement: TabPlacement;
  chromeVisible: boolean;
  /** Used for bottom safe-area padding (phone vs tablet). */
  viewport: ShellViewport;
}) {
  const location = useLocation();
  const { i18n, t } = useTranslation('settings');
  const lang = i18n.language || 'en';
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const tabElsRef = useRef(new Map<string, HTMLElement>());
  const [activeEl, setActiveEl] = useState<HTMLElement | null>(null);

  const flat = useMemo(() => flattenNavigationItems(items), [items]);
  // Cap at 4 slots total: reserve one for More when overflow or end/auth extras exist.
  const showMore = endItems.length > 0 || showAuthButton || flat.length > FLOATING_MAX_TAB_SLOTS;
  const maxPrimary = showMore ? FLOATING_MAX_TAB_SLOTS - 1 : FLOATING_MAX_TAB_SLOTS;
  const primary = useMemo(() => flat.slice(0, maxPrimary), [flat, maxPrimary]);
  // Keep config order. flex-col-reverse places the first DOM node nearest More
  // (bottom → top): overflow links, divider, end links, then account.
  const moreOverflowItems = useMemo(() => flat.slice(maxPrimary), [flat, maxPrimary]);
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
    return active ? itemKey(active) : null;
  }, [moreActive, moreOpen, primary, activePathPrefix]);

  const setTabEl = (key: string, node: HTMLElement | null) => {
    if (node) tabElsRef.current.set(key, node);
    else tabElsRef.current.delete(key);
  };

  useLayoutEffect(() => {
    if (!activeTabKey) {
      setActiveEl(null);
      return;
    }
    setActiveEl(tabElsRef.current.get(activeTabKey) ?? null);
  }, [activeTabKey, primary, showMore]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!chromeVisible) setMoreOpen(false);
  }, [chromeVisible]);

  const renderItem = (navItem: NavigationItem) => {
    const pathPrefix = getNavPathPrefix(navItem);
    const label = resolveLocalizedString(navItem.label, lang);
    const isOverlay = navItem.openIn === 'modal' || navItem.openIn === 'drawer';
    const isExternal = navItem.openIn === 'external';
    const isActive = !isOverlay && !isExternal && pathPrefix === activePathPrefix;
    const key = itemKey(navItem);

    const className = cn(
      tabClassName,
      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
    );

    const body = (
      <>
        <TabGlyph
          item={navItem}
          label={label}
        />
        <span className="w-full truncate text-center leading-tight">{label}</span>
      </>
    );

    const bindRef = (node: HTMLElement | null) => setTabEl(key, node);

    if (navItem.openIn === 'modal') {
      return (
        <button
          key={key}
          ref={bindRef}
          type="button"
          className={className}
          onClick={() => shellui.openModal(navItem.url)}
        >
          {body}
        </button>
      );
    }
    if (navItem.openIn === 'drawer') {
      return (
        <button
          key={key}
          ref={bindRef}
          type="button"
          className={className}
          onClick={() =>
            shellui.openDrawer({
              url: navItem.url,
              position: navItem.drawerPosition || 'right',
            })
          }
        >
          {body}
        </button>
      );
    }
    if (isExternal) {
      return (
        <a
          key={key}
          ref={bindRef}
          href={navItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {body}
        </a>
      );
    }

    return (
      <Link
        key={key}
        ref={bindRef}
        to={pathPrefix}
        className={className}
        aria-current={isActive ? 'page' : undefined}
      >
        {body}
      </Link>
    );
  };

  const renderMoreRow = (item: NavigationItem) => {
    const label = resolveLocalizedString(item.label, lang);
    const pathPrefix = getNavPathPrefix(item);
    const isActive =
      item.openIn !== 'modal' &&
      item.openIn !== 'drawer' &&
      item.openIn !== 'external' &&
      pathPrefix === activePathPrefix;
    const rowClass = cn(
      'flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-foreground/10',
      isActive && 'bg-foreground/10 font-medium',
    );
    const close = () => setMoreOpen(false);
    const labelEl = <span className="min-w-0 flex-1 truncate">{label}</span>;
    const iconEl = (
      <TabGlyph
        item={item}
        label={label}
      />
    );

    if (item.openIn === 'modal') {
      return (
        <button
          key={itemKey(item)}
          type="button"
          className={rowClass}
          onClick={() => {
            close();
            shellui.openModal(item.url);
          }}
        >
          {iconEl}
          {labelEl}
        </button>
      );
    }
    if (item.openIn === 'drawer') {
      return (
        <button
          key={itemKey(item)}
          type="button"
          className={rowClass}
          onClick={() => {
            close();
            shellui.openDrawer({
              url: item.url,
              position: item.drawerPosition || 'right',
            });
          }}
        >
          {iconEl}
          {labelEl}
        </button>
      );
    }
    if (item.openIn === 'external') {
      return (
        <a
          key={itemKey(item)}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={rowClass}
          onClick={close}
        >
          {iconEl}
          {labelEl}
        </a>
      );
    }

    return (
      <Link
        key={itemKey(item)}
        to={pathPrefix}
        className={rowClass}
        onClick={close}
        aria-current={isActive ? 'page' : undefined}
      >
        {iconEl}
        {labelEl}
      </Link>
    );
  };

  return (
    <div
      data-shellui-floating-tabbar={placement}
      data-chrome-visible={chromeVisible ? 'true' : 'false'}
      className={cn(
        'pointer-events-none absolute z-[45] flex justify-center',
        placement === 'bottom' ? 'inset-x-0 bottom-0' : 'inset-x-0 top-0',
      )}
      style={{
        paddingLeft: `calc(20px + var(--shellui-safe-area-left, 0px))`,
        paddingRight: `calc(20px + var(--shellui-safe-area-right, 0px))`,
        paddingBottom:
          placement === 'bottom'
            ? viewport === 'mobile'
              ? // Half margin+safe so the bar sits lower on iPhone.
                `calc((${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-bottom, 0px)) / 2)`
              : `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-bottom, 0px))`
            : undefined,
        paddingTop:
          placement === 'top'
            ? `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-top, 0px))`
            : undefined,
      }}
    >
      <nav
        ref={navRef}
        aria-label={t('develop.layout.floating', { defaultValue: 'Floating' })}
        className={cn(
          'shellui-floating-glass pointer-events-auto relative flex max-w-lg items-stretch gap-1 rounded-full px-2 py-1.5',
          placement === 'top' && 'w-auto min-w-[min(100%,28rem)] max-w-2xl scale-105',
          placement === 'bottom' && 'w-full',
        )}
        style={{ height: FLOATING_TAB_BAR_HEIGHT }}
      >
        <FloatingTabIndicator
          navRef={navRef}
          activeEl={activeEl}
        />
        {primary.map(renderItem)}
        {showMore ? (
          <div
            ref={(node) => setTabEl(MORE_TAB_KEY, node)}
            className="relative z-[1] flex min-w-0 flex-1 basis-0"
          >
            <button
              type="button"
              className={cn(
                tabClassName,
                moreOpen || moreActive ? 'text-foreground' : 'text-muted-foreground',
              )}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span className="flex size-6 shrink-0 items-center justify-center text-xl leading-none">
                …
              </span>
              <span className="w-full truncate text-center leading-tight">
                {t('develop.layout.more', { defaultValue: 'More' })}
              </span>
            </button>
            {moreOpen ? (
              <div
                role="menu"
                className={cn(
                  // First child sits nearest the More control (bottom → top).
                  'shellui-floating-glass shellui-floating-glass-menu absolute right-0 z-50 flex max-h-[min(70vh,24rem)] w-max min-w-[11rem] max-w-[min(18rem,calc(100vw-1.5rem))] flex-col-reverse gap-0.5 overflow-y-auto overscroll-contain rounded-2xl p-2 shadow-lg',
                  placement === 'bottom' ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]',
                )}
              >
                {moreOverflowItems.map(renderMoreRow)}
                {moreOverflowItems.length > 0 && (moreEndItems.length > 0 || showAuthButton) ? (
                  <div
                    role="separator"
                    className="my-1 border-t border-foreground/10"
                  />
                ) : null}
                {moreEndItems.map(renderMoreRow)}
                {showAuthButton ? (
                  <div className="px-1 pt-1">
                    <LoginButton variant="sidebar" />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
