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
import { cn } from '../../../lib/utils';
import { FLOATING_CHROME_MARGIN, FLOATING_SIDEBAR_WIDTH } from './computeFloatingInsets';

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

/** Floating glass sidebar for desktop floating layout. */
export function FloatingSidebar({
  title,
  appIcon,
  navigation,
  endItems = [],
}: {
  title?: string;
  appIcon?: ThemeAsset;
  navigation: (NavigationItem | NavigationGroup)[];
  /** Footer links (settings, login, …) — `position: 'end'`. */
  endItems?: NavigationItem[];
}) {
  const location = useLocation();
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';

  const sidebarNav = useMemo(() => filterNavigationForSidebar(navigation), [navigation]);
  const sections = useMemo(() => buildSections(sidebarNav), [sidebarNav]);
  const flat = useMemo(() => flattenNavigationItems(sidebarNav), [sidebarNav]);
  const activePathPrefix = useMemo(
    () => getActivePathPrefix(location.pathname, [...flat, ...endItems]),
    [location.pathname, flat, endItems],
  );

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
    <aside
      data-shellui-floating-sidebar=""
      className="pointer-events-none absolute inset-y-0 left-0 z-[45] flex"
      style={{
        paddingTop: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-top, 0px))`,
        paddingBottom: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-bottom, 0px))`,
        paddingLeft: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-left, 0px))`,
      }}
    >
      <nav
        className="shellui-floating-glass pointer-events-auto flex h-full flex-col overflow-hidden rounded-[1.35rem]"
        style={{ width: FLOATING_SIDEBAR_WIDTH }}
        aria-label={title || 'Navigation'}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-white/15 px-3 py-3 dark:border-white/10">
          {appIcon ? (
            <AppBrandIcon
              appIcon={appIcon}
              title={title}
              className="size-7 shrink-0"
            />
          ) : null}
          {title ? (
            <span
              className="truncate text-sm font-semibold tracking-tight"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {title}
            </span>
          ) : null}
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

        {endItems.length > 0 ? (
          <div className="flex shrink-0 flex-col gap-0.5 border-t border-white/15 p-2 dark:border-white/10">
            {endItems.map(renderItem)}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
