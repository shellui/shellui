import { Link, useLocation } from 'react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem, NavigationGroup, ThemeAsset } from '../../config/types';
import {
  flattenNavigationItems,
  getActivePathPrefix,
  getNavPathPrefix,
  resolveLocalizedString,
  filterNavigationForSidebar,
} from '../utils';
import { getExternalFaviconUrl } from '../sidebar/sidebarUtils';
import { NavIcon, ExternalLinkIcon } from '../sidebar/SidebarIcons';
import { AppBrandIcon } from '../branding/AppBrandIcon';
import { LoginButton } from '../../auth/components/LoginButton';
import { cn } from '../../../lib/utils';
import { useIsTauriClient, useMacTrafficLights } from '../chrome/runtime';
import { MAC_TRAFFIC_LIGHTS_WIDTH_PX } from '../chrome/constants';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_SIDEBAR_TOGGLE_SIZE,
  FLOATING_SIDEBAR_WIDTH,
} from './computeFloatingInsets';

const isGroup = (item: NavigationItem | NavigationGroup): item is NavigationGroup => {
  return 'title' in item && 'items' in item;
};

type NavSection =
  | { type: 'group'; group: NavigationGroup }
  | { type: 'items'; items: NavigationItem[] };

function buildSections(navigation: (NavigationItem | NavigationGroup)[]): NavSection[] {
  const result: NavSection[] = [];
  for (const item of navigation) {
    if (isGroup(item)) {
      result.push({ type: 'group', group: item });
      continue;
    }
    const last = result[result.length - 1];
    if (last?.type === 'items') {
      last.items.push(item);
    } else {
      result.push({ type: 'items', items: [item] });
    }
  }
  return result;
}

function SidebarPanelIcon({ className }: { className?: string }) {
  return (
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
      className={className}
      aria-hidden
    >
      <rect
        width="18"
        height="18"
        x="3"
        y="3"
        rx="2"
      />
      <path d="M9 3v18" />
    </svg>
  );
}

/** Floating glass sidebar for desktop floating layout (collapsible). */
export function FloatingSidebar({
  title,
  appIcon,
  navigation,
  endItems = [],
  showAuthButton = false,
  collapsed,
  onToggleCollapsed,
}: {
  title?: string;
  appIcon?: ThemeAsset;
  navigation: (NavigationItem | NavigationGroup)[];
  /** Footer links (settings, login, …) — `position: 'end'`. */
  endItems?: NavigationItem[];
  /** Account / login control (same semantics as sidebar layout). */
  showAuthButton?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const location = useLocation();
  const { i18n, t } = useTranslation('settings');
  const lang = i18n.language || 'en';
  const trafficLights = useMacTrafficLights();
  const isTauriEnv = useIsTauriClient();
  const trafficPadPx = trafficLights ? MAC_TRAFFIC_LIGHTS_WIDTH_PX : 0;
  /** History cluster only for the collapsed chip (shares the top-left corner on Tauri). */
  const chipLeadingPx = trafficPadPx + (isTauriEnv ? 72 : 0);

  const sidebarNav = useMemo(() => filterNavigationForSidebar(navigation), [navigation]);
  const sections = useMemo(() => buildSections(sidebarNav), [sidebarNav]);
  const flat = useMemo(() => flattenNavigationItems(sidebarNav), [sidebarNav]);
  const activePathPrefix = useMemo(
    () => getActivePathPrefix(location.pathname, [...flat, ...endItems]),
    [location.pathname, flat, endItems],
  );

  const sidebarEdgePad = {
    paddingTop: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-top, 0px))`,
    paddingLeft: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-left, 0px) + ${trafficPadPx}px)`,
    paddingBottom: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-bottom, 0px))`,
  };

  const chipEdgePad = {
    paddingTop: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-top, 0px))`,
    paddingLeft: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-left, 0px) + ${chipLeadingPx}px)`,
  };

  const toggleLabel = collapsed
    ? t('develop.layout.showSidebar', { defaultValue: 'Show sidebar' })
    : t('develop.layout.hideSidebar', { defaultValue: 'Hide sidebar' });

  const renderItem = (navItem: NavigationItem) => {
    const pathPrefix = getNavPathPrefix(navItem);
    const label = resolveLocalizedString(navItem.label, lang);
    const isOverlay = navItem.openIn === 'modal' || navItem.openIn === 'drawer';
    const isExternal = navItem.openIn === 'external';
    const isActive = !isOverlay && !isExternal && pathPrefix === activePathPrefix;
    const faviconUrl = isExternal && !navItem.icon ? getExternalFaviconUrl(navItem.url) : null;
    const iconSrc = navItem.icon ?? faviconUrl ?? null;

    const className = cn(
      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors',
      isActive
        ? 'bg-foreground/10 font-medium text-foreground'
        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
    );

    const content = (
      <>
        <NavIcon
          src={iconSrc}
          className="size-4 shrink-0"
        />
        <span className="truncate">{label}</span>
        {isExternal ? <ExternalLinkIcon className="ml-auto size-3.5 opacity-70" /> : null}
      </>
    );

    if (navItem.openIn === 'modal') {
      return (
        <button
          key={`${navItem.path}-${navItem.url}`}
          type="button"
          className={className}
          onClick={() => shellui.openModal(navItem.url)}
        >
          {content}
        </button>
      );
    }
    if (navItem.openIn === 'drawer') {
      return (
        <button
          key={`${navItem.path}-${navItem.url}`}
          type="button"
          className={className}
          onClick={() => shellui.openDrawer({ url: navItem.url, position: navItem.drawerPosition })}
        >
          {content}
        </button>
      );
    }
    if (isExternal) {
      return (
        <a
          key={`${navItem.path}-${navItem.url}`}
          href={navItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        key={`${navItem.path}-${navItem.url}`}
        to={pathPrefix}
        className={className}
        aria-current={isActive ? 'page' : undefined}
      >
        {content}
      </Link>
    );
  };

  return (
    <>
      {/* Collapsed expand chip — fades/scales in after the panel slides away. */}
      <div
        data-shellui-floating-sidebar="collapsed"
        className={cn(
          'shellui-floating-sidebar-chip pointer-events-none absolute top-0 left-0 z-[46] flex',
          collapsed ? 'pointer-events-none opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={chipEdgePad}
        aria-hidden={!collapsed}
      >
        <button
          type="button"
          tabIndex={collapsed ? 0 : -1}
          className={cn(
            'shellui-floating-glass flex items-center justify-center rounded-xl text-foreground',
            'transition-[transform,opacity] duration-150 ease-out',
            'hover:opacity-95 active:scale-[0.98]',
            collapsed
              ? 'pointer-events-auto scale-100 opacity-100 delay-75'
              : 'pointer-events-none scale-90 opacity-0 delay-0',
          )}
          style={{ width: FLOATING_SIDEBAR_TOGGLE_SIZE, height: FLOATING_SIDEBAR_TOGGLE_SIZE }}
          aria-label={toggleLabel}
          aria-expanded={false}
          onClick={onToggleCollapsed}
        >
          <SidebarPanelIcon className="size-4" />
        </button>
      </div>

      {/* Expanded panel — GPU slide + fade (transform/opacity only). */}
      <aside
        data-shellui-floating-sidebar="expanded"
        className={cn(
          'shellui-floating-sidebar-panel pointer-events-none absolute inset-y-0 left-0 z-[45] flex',
          collapsed && 'pointer-events-none',
        )}
        style={sidebarEdgePad}
        aria-hidden={collapsed}
      >
        <nav
          className={cn(
            'shellui-floating-glass pointer-events-auto flex h-full flex-col overflow-hidden rounded-[1.35rem]',
            'origin-left will-change-transform',
            'transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
            collapsed
              ? 'pointer-events-none -translate-x-[calc(100%+1.25rem)] scale-[0.98] opacity-0'
              : 'translate-x-0 scale-100 opacity-100',
          )}
          style={{ width: FLOATING_SIDEBAR_WIDTH }}
          aria-label={title || 'Navigation'}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-white/15 px-2.5 py-2.5 dark:border-white/10">
            {appIcon ? (
              <AppBrandIcon
                appIcon={appIcon}
                title={title}
                className="size-7 shrink-0"
              />
            ) : null}
            {title ? (
              <span
                className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
                {title}
              </span>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            <button
              type="button"
              tabIndex={collapsed ? -1 : 0}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
            >
              <SidebarPanelIcon className="size-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
            {sections.map((section, sectionIndex) => {
              if (section.type === 'group') {
                const groupTitle = resolveLocalizedString(section.group.title, lang);
                return (
                  <div
                    key={`group-${groupTitle}-${sectionIndex}`}
                    className="flex flex-col gap-0.5"
                  >
                    <div
                      className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase"
                      style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                    >
                      {groupTitle}
                    </div>
                    {section.group.items.map(renderItem)}
                  </div>
                );
              }

              return (
                <div
                  key={`items-${section.items.map((i) => i.path).join('-')}-${sectionIndex}`}
                  className="flex flex-col gap-0.5"
                >
                  {section.items.map(renderItem)}
                </div>
              );
            })}
          </div>

          {endItems.length > 0 || showAuthButton ? (
            <div className="flex shrink-0 flex-col gap-0.5 border-t border-white/15 p-2 dark:border-white/10">
              {endItems.map(renderItem)}
              {showAuthButton ? (
                <div className="px-0.5 pt-0.5">
                  <LoginButton variant="sidebar" />
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>
      </aside>
    </>
  );
}
