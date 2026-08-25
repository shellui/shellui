import { Link, useLocation } from 'react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type { NavigationItem, NavigationGroup } from '../../config/types';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '../../../components/ui/sidebar';
import { cn } from '../../../lib/utils';
import { getActivePathPrefix, getNavPathPrefix, flattenNavigationItems } from '../utils';
import { getExternalFaviconUrl } from './sidebarUtils';
import { DefaultNavIcon, ExternalLinkIcon } from './SidebarIcons';

const isGroup = (item: NavigationItem | NavigationGroup): item is NavigationGroup => {
  return 'title' in item && 'items' in item;
};

export function NavigationContent({
  navigation,
}: {
  navigation: (NavigationItem | NavigationGroup)[];
}) {
  const location = useLocation();
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  const resolveLocalizedString = (
    value: string | { en: string; fr: string; [key: string]: string },
    lang: string,
  ): string => {
    if (typeof value === 'string') return value;
    return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
  };

  const flatItems = useMemo(() => flattenNavigationItems(navigation), [navigation]);
  const activePathPrefix = useMemo(
    () => getActivePathPrefix(location.pathname, flatItems),
    [location.pathname, flatItems],
  );

  // Chunk consecutive top-level items into one SidebarGroup so spacing matches
  // items inside titled groups (one group padding, not one per item).
  const sections = useMemo(() => {
    const result: Array<
      { type: 'group'; group: NavigationGroup } | { type: 'items'; items: NavigationItem[] }
    > = [];

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
  }, [navigation]);

  const renderNavItem = (navItem: NavigationItem) => {
    const pathPrefix = getNavPathPrefix(navItem);
    const isOverlay = navItem.openIn === 'modal' || navItem.openIn === 'drawer';
    const isExternal = navItem.openIn === 'external';
    const isActive = !isOverlay && !isExternal && pathPrefix === activePathPrefix;
    const itemLabel = resolveLocalizedString(navItem.label, currentLanguage);
    const faviconUrl = isExternal && !navItem.icon ? getExternalFaviconUrl(navItem.url) : null;
    const iconSrc = navItem.icon ?? faviconUrl ?? null;
    const iconEl = iconSrc ? (
      <img
        src={iconSrc}
        alt=""
        className="size-4 shrink-0"
      />
    ) : (
      <DefaultNavIcon />
    );
    const externalIcon = isExternal ? (
      <ExternalLinkIcon className="ml-auto size-4 shrink-0 opacity-70" />
    ) : null;
    const content = (
      <>
        {iconEl}
        <span className="truncate">{itemLabel}</span>
        {externalIcon}
      </>
    );
    const linkOrTrigger =
      navItem.openIn === 'modal' ? (
        <button
          type="button"
          onClick={() => shellui.openModal(navItem.url)}
          className="flex items-center gap-2 w-full cursor-pointer text-left"
        >
          {content}
        </button>
      ) : navItem.openIn === 'drawer' ? (
        <button
          type="button"
          onClick={() => shellui.openDrawer({ url: navItem.url, position: navItem.drawerPosition })}
          className="flex items-center gap-2 w-full cursor-pointer text-left"
        >
          {content}
        </button>
      ) : navItem.openIn === 'external' ? (
        <a
          href={navItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full"
        >
          {content}
        </a>
      ) : (
        <Link
          to={pathPrefix}
          className="flex items-center gap-2 w-full"
        >
          {content}
        </Link>
      );
    return (
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={itemLabel}
        className={cn('w-full', isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')}
      >
        {linkOrTrigger}
      </SidebarMenuButton>
    );
  };

  return (
    <>
      {sections.map((section, sectionIndex) => {
        if (section.type === 'group') {
          const groupTitle = resolveLocalizedString(section.group.title, currentLanguage);
          return (
            <SidebarGroup
              key={`group-${groupTitle}-${sectionIndex}`}
              className="mt-0"
            >
              <SidebarGroupLabel className="mb-1">{groupTitle}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.group.items.map((navItem) => (
                    <SidebarMenuItem key={navItem.path}>{renderNavItem(navItem)}</SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        }

        return (
          <SidebarGroup
            key={`items-${section.items.map((i) => i.path).join('-')}-${sectionIndex}`}
            className="mt-0"
          >
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((navItem) => (
                  <SidebarMenuItem key={navItem.path}>{renderNavItem(navItem)}</SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}
