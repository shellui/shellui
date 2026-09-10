import { Link, useLocation } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
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
  FLOATING_MAX_TAB_ITEMS,
  FLOATING_TAB_BAR_HEIGHT,
} from './computeFloatingInsets';

type TabPlacement = 'bottom' | 'top';

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
    <span className="flex size-5 items-center justify-center text-[11px] font-semibold leading-none">
      {label.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function itemKey(item: NavigationItem): string {
  return `${item.path}-${item.url}`;
}

/** Floating glass tab bar — bottom-centered on phone and tablet. */
export function FloatingTabBar({
  items,
  endItems = [],
  showAuthButton = false,
  placement,
  chromeVisible,
}: {
  items: NavigationItem[];
  /** `position: 'end'` links (settings, login, …) — shown in the More sheet. */
  endItems?: NavigationItem[];
  /** Account / login control when the login nav item is hidden (logged in). */
  showAuthButton?: boolean;
  placement: TabPlacement;
  chromeVisible: boolean;
}) {
  const location = useLocation();
  const { i18n, t } = useTranslation('settings');
  const lang = i18n.language || 'en';
  const [moreOpen, setMoreOpen] = useState(false);

  const flat = useMemo(() => flattenNavigationItems(items), [items]);
  const primary = flat.slice(0, FLOATING_MAX_TAB_ITEMS);
  const overflow = flat.slice(FLOATING_MAX_TAB_ITEMS);
  const moreItems = useMemo(() => [...overflow, ...endItems], [overflow, endItems]);
  const showMore = moreItems.length > 0 || showAuthButton;

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

    const className = cn(
      'shellui-floating-tab flex min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-medium transition-[transform,background-color,color] duration-200',
      isActive
        ? 'bg-foreground/10 text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    );

    const body = (
      <>
        <TabGlyph
          item={navItem}
          label={label}
        />
        <span className="max-w-[4.5rem] truncate">{label}</span>
      </>
    );

    if (navItem.openIn === 'modal') {
      return (
        <button
          key={itemKey(navItem)}
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
          key={itemKey(navItem)}
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
          key={itemKey(navItem)}
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
        key={itemKey(navItem)}
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
        'pointer-events-none absolute z-[45] flex justify-center px-3 transition-[transform,opacity] duration-300 ease-out',
        placement === 'bottom' ? 'inset-x-0 bottom-0' : 'inset-x-0 top-0',
        !chromeVisible &&
          (placement === 'bottom'
            ? 'translate-y-[120%] opacity-0'
            : '-translate-y-[120%] opacity-0'),
      )}
      style={{
        paddingBottom:
          placement === 'bottom'
            ? `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-bottom, 0px))`
            : undefined,
        paddingTop:
          placement === 'top'
            ? `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-top, 0px))`
            : undefined,
      }}
    >
      <nav
        aria-label={t('develop.layout.floating', { defaultValue: 'Floating' })}
        className={cn(
          'shellui-floating-glass pointer-events-auto relative flex max-w-lg items-stretch gap-0.5 rounded-[1.35rem] px-1.5',
          placement === 'top' && 'w-auto min-w-[min(100%,28rem)] max-w-2xl scale-105',
          placement === 'bottom' && 'w-full',
        )}
        style={{ minHeight: FLOATING_TAB_BAR_HEIGHT }}
      >
        {primary.map(renderItem)}
        {showMore ? (
          <div className="relative flex min-w-0 flex-1">
            <button
              type="button"
              className={cn(
                'shellui-floating-tab flex min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-medium text-muted-foreground',
                (moreOpen || moreActive) && 'bg-foreground/10 text-foreground',
              )}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span className="flex size-5 items-center justify-center text-base leading-none">
                …
              </span>
              <span>{t('develop.layout.more', { defaultValue: 'More' })}</span>
            </button>
            {moreOpen ? (
              <div
                role="menu"
                className={cn(
                  // Anchor to the More control’s right edge and grow left so the sheet
                  // stays inside the viewport on narrow phones.
                  'shellui-floating-glass absolute right-0 z-50 flex max-h-[min(70vh,24rem)] w-max min-w-[11rem] max-w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-2xl p-2 shadow-lg',
                  placement === 'bottom' ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]',
                )}
              >
                {overflow.map(renderMoreRow)}
                {overflow.length > 0 && (endItems.length > 0 || showAuthButton) ? (
                  <div
                    role="separator"
                    className="my-1 border-t border-foreground/10"
                  />
                ) : null}
                {endItems.map(renderMoreRow)}
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
