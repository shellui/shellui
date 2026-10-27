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
import { DesktopHistoryButtons } from '../chrome/DesktopHistoryButtons';
import { useIsTauriClient, useIsTauriRuntime, useMacOverlayChrome } from '../chrome/runtime';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  DESKTOP_TITLEBAR_PAD_TOP_PX,
  SHELL_HEADER_HEIGHT_PX,
  SHELL_HEADER_PAD_TOP_PX,
} from '../chrome/constants';
import { MAC_DRAG_REGION_PROPS, MacLightsSafeArea, MacStripSpacer } from '../chrome/MacStrip';
import {
  FLOATING_CHROME_MARGIN,
  FLOATING_HISTORY_CLUSTER_PX,
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

/** Web brand row height (spec: 52px). */
const FLOATING_BRAND_ROW_PX = 52;

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
  const { i18n } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const lang = i18n.language || 'en';
  const isTauriEnv = useIsTauriClient();
  const tauriRuntime = useIsTauriRuntime();
  /** macOS: the panel top is the 32px strip; collapsed, a 32px strip runs over the content. */
  const macStrip = useMacOverlayChrome();
  /** Tauri drops the floating edge gap so this row shares the title bar band. */
  const edgeMargin = tauriRuntime ? 0 : FLOATING_CHROME_MARGIN;
  /** Collapsed chip clears the history cluster (Windows / Linux Tauri). */
  const chipLeadingPx = isTauriEnv ? FLOATING_HISTORY_CLUSTER_PX : 0;

  const sidebarNav = useMemo(() => filterNavigationForSidebar(navigation), [navigation]);
  const sections = useMemo(() => buildSections(sidebarNav), [sidebarNav]);
  const flat = useMemo(() => flattenNavigationItems(sidebarNav), [sidebarNav]);
  const activePathPrefix = useMemo(
    () => getActivePathPrefix(location.pathname, [...flat, ...endItems]),
    [location.pathname, flat, endItems],
  );

  const sidebarEdgePad = {
    paddingTop: `calc(${edgeMargin}px + var(--shellui-safe-area-top, 0px))`,
    paddingLeft: `calc(${edgeMargin}px + var(--shellui-safe-area-left, 0px))`,
    paddingBottom: `calc(${edgeMargin}px + var(--shellui-safe-area-bottom, 0px))`,
  };

  const chipEdgePad = tauriRuntime
    ? {
        height: SHELL_HEADER_HEIGHT_PX,
        paddingTop: SHELL_HEADER_PAD_TOP_PX,
        paddingLeft: `calc(var(--shellui-safe-area-left, 0px) + ${chipLeadingPx}px)`,
        boxSizing: 'border-box' as const,
        alignItems: 'center',
      }
    : {
        paddingTop: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-top, 0px))`,
        paddingLeft: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-left, 0px) + ${chipLeadingPx}px)`,
      };

  const toggleLabel = collapsed
    ? tc('shellChrome.expandSidebar')
    : tc('shellChrome.collapseSidebar');

  const renderItem = (navItem: NavigationItem) => {
    const pathPrefix = getNavPathPrefix(navItem);
    const label = resolveLocalizedString(navItem.label, lang);
    const isOverlay = navItem.openIn === 'modal' || navItem.openIn === 'drawer';
    const isExternal = navItem.openIn === 'external';
    const isActive = !isOverlay && !isExternal && pathPrefix === activePathPrefix;
    const faviconUrl = isExternal && !navItem.icon ? getExternalFaviconUrl(navItem.url) : null;
    const iconSrc = navItem.icon ?? faviconUrl ?? null;

    const className = cn(
      // Colours, hover and active pill live in index.css (`.shellui-floating-nav-item`).
      'shellui-floating-nav-item flex h-8 w-full items-center gap-2.5 px-2.5 text-sm',
      isActive && 'is-active',
    );

    const content = (
      <>
        <NavIcon
          src={iconSrc}
          className="shellui-nav-icon size-4 shrink-0"
        />
        <span className="truncate">{label}</span>
        {isExternal ? (
          <>
            <ExternalLinkIcon className="ml-auto size-3.5 opacity-70" />
            <span className="sr-only">{tc('shellChrome.externalLink')}</span>
          </>
        ) : null}
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
      {macStrip ? (
        /*
         * macOS collapsed: 32px strip over the content. Safe area 80, one glass group
         * (expand, back, forward), then a drag spacer.
         */
        <div
          data-shellui-floating-sidebar="collapsed"
          data-shellui-mac-strip=""
          {...MAC_DRAG_REGION_PROPS}
          className={cn(
            'absolute inset-x-0 top-0 z-[46] flex items-center select-none',
            collapsed ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: DESKTOP_TITLEBAR_HEIGHT_PX, paddingTop: DESKTOP_TITLEBAR_PAD_TOP_PX }}
          aria-hidden={!collapsed}
          inert={!collapsed ? true : undefined}
        >
          <MacLightsSafeArea />
          <div
            data-shellui-no-drag=""
            className="shellui-history-glass flex shrink-0 items-center text-sidebar-foreground"
          >
            <button
              type="button"
              tabIndex={collapsed ? 0 : -1}
              className="shellui-floating-nav-control flex size-6 shrink-0 items-center justify-center transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label={toggleLabel}
              aria-expanded={false}
              onClick={onToggleCollapsed}
            >
              <SidebarPanelIcon className="size-4" />
            </button>
            {isTauriEnv ? <DesktopHistoryButtons strip /> : null}
          </div>
          <MacStripSpacer />
        </div>
      ) : null}

      {/* Collapsed expand chip — fades/scales in after the panel slides away. */}
      <div
        hidden={macStrip}
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
            'shellui-floating-glass flex items-center justify-center text-sidebar-foreground',
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
          data-shellui-tauri-flush={tauriRuntime ? '' : undefined}
          className={cn(
            'shellui-floating-glass pointer-events-auto flex h-full flex-col overflow-hidden',
            'origin-left will-change-transform',
            'transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
            collapsed
              ? 'pointer-events-none -translate-x-[calc(100%+1.25rem)] scale-[0.98] opacity-0'
              : 'translate-x-0 scale-100 opacity-100',
          )}
          style={{ width: FLOATING_SIDEBAR_WIDTH }}
          aria-label={tc('shellChrome.mainNav')}
        >
          {macStrip ? (
            <>
              {/* macOS strip: safe 80, drag spacer, back, forward, collapse. */}
              <div
                data-shellui-mac-strip=""
                {...MAC_DRAG_REGION_PROPS}
                className="flex shrink-0 items-center pr-2"
                style={{
                  height: DESKTOP_TITLEBAR_HEIGHT_PX,
                  paddingTop: DESKTOP_TITLEBAR_PAD_TOP_PX,
                }}
              >
                <MacLightsSafeArea />
                <MacStripSpacer />
                {isTauriEnv && !collapsed ? <DesktopHistoryButtons strip /> : null}
                <button
                  type="button"
                  tabIndex={collapsed ? -1 : 0}
                  data-shellui-no-drag=""
                  className="shellui-floating-nav-control flex size-6 shrink-0 items-center justify-center text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label={toggleLabel}
                  aria-expanded={!collapsed}
                  onClick={onToggleCollapsed}
                >
                  <SidebarPanelIcon className="size-4" />
                </button>
              </div>
              {/* Brand row under the strip: not a drag region. */}
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-sidebar-border/80 px-3 text-sidebar-foreground">
                {appIcon ? (
                  <AppBrandIcon
                    appIcon={appIcon}
                    title={title}
                    className="size-5 shrink-0"
                  />
                ) : null}
                {title ? (
                  <span className="min-w-0 truncate text-[13px] font-semibold">{title}</span>
                ) : null}
              </div>
            </>
          ) : (
            <div
              className={cn(
                'flex shrink-0 items-center border-b border-sidebar-border/80',
                tauriRuntime ? 'pr-2.5' : 'pr-2 pl-3.5',
              )}
              style={
                tauriRuntime
                  ? {
                      height: SHELL_HEADER_HEIGHT_PX,
                      paddingTop: SHELL_HEADER_PAD_TOP_PX,
                    }
                  : { height: FLOATING_BRAND_ROW_PX }
              }
              {...(tauriRuntime ? MAC_DRAG_REGION_PROPS : {})}
            >
              <div
                className={cn(
                  'flex h-full min-w-0 flex-1 items-center',
                  tauriRuntime ? 'gap-1' : 'gap-1.5',
                )}
              >
                {isTauriEnv && !collapsed ? (
                  <DesktopHistoryButtons className="self-center" />
                ) : null}
                {appIcon ? (
                  <AppBrandIcon
                    appIcon={appIcon}
                    title={title}
                    className={cn('shrink-0', tauriRuntime ? 'size-7' : 'size-5')}
                  />
                ) : null}
                {/* Web brand row: logo + name (the Tauri bar hides the name, like the mock). */}
                {!tauriRuntime && title ? (
                  <span
                    aria-hidden={appIcon ? true : undefined}
                    data-shellui-floating-brand-name=""
                    className="ml-0.5 min-w-0 truncate text-sm font-semibold text-sidebar-foreground"
                  >
                    {title}
                  </span>
                ) : null}
                <span
                  className="min-h-full min-w-0 flex-1 self-stretch"
                  {...(tauriRuntime ? MAC_DRAG_REGION_PROPS : {})}
                />
                <button
                  type="button"
                  tabIndex={collapsed ? -1 : 0}
                  data-shellui-no-drag=""
                  className="shellui-floating-nav-control flex size-9 shrink-0 items-center justify-center text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label={toggleLabel}
                  aria-expanded={!collapsed}
                  onClick={onToggleCollapsed}
                >
                  <SidebarPanelIcon className="size-4" />
                </button>
              </div>
            </div>
          )}

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
                      className="shellui-floating-nav-label px-2.5 pb-1 text-xs font-semibold"
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
            <div className="flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border/80 p-2">
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
