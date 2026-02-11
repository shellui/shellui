import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../components/ui/breadcrumb';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '../../components/ui/sidebar';
import { Route, Routes, useLocation, useNavigate, Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import urls from '../../constants/urls';
import { createSettingsRoutes } from './SettingsRoutes';
import { useSettings } from './hooks/useSettings';
import { useConfig } from '../config/useConfig';
import { isTauri } from '../../service-worker/register';
import { Button } from '../../components/ui/button';
import { ChevronRightIcon, ChevronLeftIcon } from './SettingsIcons';
import { flattenNavigationItems, resolveLocalizedString } from '../layouts/utils';
import { ApplicationSettingsPanel } from './components/ApplicationSettingsPanel';
import type { NavigationItem } from '../config/types';
import { cn } from '../../lib/utils';

export const SettingsView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { config } = useConfig();
  const { t, i18n } = useTranslation('settings');
  // Re-check isTauri after mount and after a short delay so we catch late-injected __TAURI__ in dev
  const [isTauriEnv, setIsTauriEnv] = useState(() => isTauri());

  useEffect(() => {
    setIsTauriEnv(isTauri());
    const tid = window.setTimeout(() => setIsTauriEnv(isTauri()), 200);
    return () => window.clearTimeout(tid);
  }, []);

  useEffect(() => {
    if (config?.title) {
      const settingsLabel = t('settings', { ns: 'common' });
      document.title = `${settingsLabel} | ${config.title}`;
    }
  }, [config?.title, t]);

  // Create routes with translations (service-worker route is already omitted in Tauri by createSettingsRoutes)
  const settingsRoutes = useMemo(() => createSettingsRoutes(t), [t]);

  // In Tauri, hide service worker route; use reactive isTauriEnv so we catch late injection (e.g. dev)
  const routesWithoutTauriSw = useMemo(() => {
    if (isTauriEnv) {
      return settingsRoutes.filter((route) => route.path !== 'service-worker');
    }
    return settingsRoutes;
  }, [settingsRoutes, isTauriEnv]);

  // Filter routes based on developer features setting
  const filteredRoutes = useMemo(() => {
    if (settings.developerFeatures.enabled) {
      return routesWithoutTauriSw;
    }
    return routesWithoutTauriSw.filter(
      (route) => route.path !== 'developpers' && route.path !== 'service-worker',
    );
  }, [settings.developerFeatures.enabled, routesWithoutTauriSw]);

  // Application settings from navigation items with settings URL
  const applicationRoutes = useMemo(() => {
    const lang = i18n.language || 'en';
    const flat = config?.navigation ? flattenNavigationItems(config.navigation) : [];
    return flat
      .filter((item) => item.settings)
      .map((item) => {
        const pathPrefix = `${urls.settings.replace(/^\/+/, '')}/app-${item.path}`;
        const navItem: NavigationItem = {
          ...item,
          url: item.settings!,
        };
        return {
          name: resolveLocalizedString(item.label, lang),
          iconSrc: item.icon ?? undefined,
          path: `app-${item.path}`,
          element: (
            <ApplicationSettingsPanel
              url={item.settings!}
              pathPrefix={pathPrefix}
              navItem={navItem}
            />
          ),
        };
      });
  }, [config?.navigation, i18n.language]);

  // All routes (core + applications) for selection and routing
  const allRoutes = useMemo(
    () => [...filteredRoutes, ...applicationRoutes],
    [filteredRoutes, applicationRoutes],
  );

  // Group routes by category
  const groupedRoutes = useMemo(() => {
    const developerOnlyPaths = ['developpers', 'service-worker'];
    const groups = [
      ...(applicationRoutes.length > 0
        ? [{ title: t('categories.applications'), routes: applicationRoutes }]
        : []),
      {
        title: t('categories.preferences'),
        routes: filteredRoutes.filter((route) =>
          ['appearance', 'language-and-region', 'data-privacy'].includes(route.path),
        ),
      },
      {
        title: t('categories.system'),
        routes: filteredRoutes.filter((route) => ['update-app', 'advanced'].includes(route.path)),
      },
      {
        title: t('categories.developer'),
        routes: filteredRoutes.filter((route) => developerOnlyPaths.includes(route.path)),
      },
    ];
    return groups.filter((group) => group.routes.length > 0);
  }, [filteredRoutes, applicationRoutes, t]);

  // Find matching nav item by checking if URL contains or ends with the item path
  const getSelectedItemFromUrl = useCallback(() => {
    const pathname = location.pathname;

    // Find matching nav item by checking if pathname contains the item path
    // This works regardless of the URL structure/prefix
    const matchedItem = allRoutes.find((item) => {
      // Normalize paths for comparison (remove leading/trailing slashes)
      const normalizedPathname = pathname.replace(/^\/+|\/+$/g, '');
      const normalizedItemPath = item.path.replace(/^\/+|\/+$/g, '');

      // Check if pathname ends with the item path, or contains it as a path segment
      return (
        normalizedPathname === normalizedItemPath ||
        normalizedPathname.endsWith(`/${normalizedItemPath}`) ||
        normalizedPathname.includes(`/${normalizedItemPath}/`)
      );
    });

    return matchedItem;
  }, [location.pathname, allRoutes]);

  const selectedItem = useMemo(() => getSelectedItemFromUrl(), [getSelectedItemFromUrl]);

  // Check if we're at the settings root (no specific route selected)
  const isSettingsRoot = useMemo(() => {
    const pathname = location.pathname;
    // Normalize the settings URL (remove leading/trailing slashes)
    const normalizedSettingsPath = urls.settings.replace(/^\/+|\/+$/g, '');
    // Normalize the current pathname (remove leading/trailing slashes)
    const normalizedPathname = pathname.replace(/^\/+|\/+$/g, '');

    // Check if we're exactly at the settings root
    // This handles both "/__settings" and "/__settings/" cases
    if (normalizedPathname === normalizedSettingsPath) {
      return true;
    }

    // If pathname starts with settings path followed by a slash, we're at a subpage
    // e.g., "__settings/appearance" means we're NOT at root
    const settingsPathWithSlash = `${normalizedSettingsPath}/`;
    if (normalizedPathname.startsWith(settingsPathWithSlash)) {
      return false;
    }

    // Pathname doesn't match settings path structure - not in settings
    return false;
  }, [location.pathname]);

  // Navigate back to settings root
  const handleBackToSettings = useCallback(() => {
    // Navigate to settings root, replacing current history entry
    navigate(urls.settings, { replace: true });
  }, [navigate]);

  return (
    <SidebarProvider>
      <div className="flex h-full w-full overflow-hidden items-start">
        {/* Desktop Sidebar */}
        <Sidebar className="hidden md:flex">
          <SidebarContent>
            {groupedRoutes.map((group) => (
              <SidebarGroup key={group.title}>
                <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.routes.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.name === selectedItem?.name}
                        >
                          <button
                            onClick={() => navigate(`${urls.settings}/${item.path}`)}
                            className="cursor-pointer"
                          >
                            {'icon' in item && item.icon ? (
                              <item.icon />
                            ) : 'iconSrc' in item && item.iconSrc ? (
                              <img
                                src={item.iconSrc}
                                alt=""
                                className="h-4 w-4 shrink-0"
                              />
                            ) : (
                              <span className="h-4 w-4 shrink-0" />
                            )}
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>

        {/* Mobile List View */}
        <div className="md:hidden flex h-full w-full flex-col overflow-hidden">
          {isSettingsRoot ? (
            // Show list of settings pages
            <div className="flex flex-1 flex-col overflow-y-auto bg-background">
              <header className="flex h-16 shrink-0 items-center justify-center px-4 border-b">
                <h1 className="text-lg font-semibold">{t('title')}</h1>
              </header>
              <div className="flex flex-1 flex-col p-4 gap-6">
                {groupedRoutes.map((group) => (
                  <div
                    key={group.title}
                    className="flex flex-col gap-2"
                  >
                    <h2
                      className="text-xs font-semibold text-foreground/60 uppercase tracking-wider px-2"
                      style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                    >
                      {group.title}
                    </h2>
                    <div className="flex flex-col bg-card rounded-lg overflow-hidden border border-border">
                      {group.routes.map((item, itemIndex) => {
                        const isLast = itemIndex === group.routes.length - 1;
                        const iconEl =
                          'icon' in item && item.icon ? (
                            <item.icon />
                          ) : 'iconSrc' in item && item.iconSrc ? (
                            <img
                              src={item.iconSrc}
                              alt=""
                              className="h-4 w-4 shrink-0"
                            />
                          ) : (
                            <span className="h-4 w-4 shrink-0" />
                          );
                        return (
                          <div
                            key={item.name}
                            className="relative"
                          >
                            {!isLast && (
                              <div className="absolute left-0 right-0 bottom-0 h-[1px] bg-border" />
                            )}
                            <button
                              onClick={() => navigate(`${urls.settings}/${item.path}`)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground transition-colors cursor-pointer rounded-none"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="flex-shrink-0 text-foreground/70">{iconEl}</div>
                                <span className="text-sm font-normal text-foreground">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex-shrink-0 ml-2 text-foreground/40">
                                <ChevronRightIcon />
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Show selected settings page with back button
            <div className="flex h-full flex-1 flex-col overflow-hidden">
              <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToSettings}
                  className="mr-2"
                >
                  <ChevronLeftIcon />
                </Button>
                <h1 className="text-lg font-semibold">{selectedItem?.name}</h1>
              </header>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-4">
                <Routes>
                  <Route
                    index
                    element={
                      allRoutes.length > 0 ? (
                        <Navigate
                          to={`${urls.settings}/${allRoutes[0].path}`}
                          replace
                        />
                      ) : null
                    }
                  />
                  {allRoutes.map((item) => (
                    <Route
                      key={item.path}
                      path={item.path}
                      element={item.element}
                    />
                  ))}
                </Routes>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Main Content */}
        <main className="hidden md:flex h-full flex-1 flex-col overflow-hidden">
          {selectedItem && (
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>{t('title')}</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{selectedItem.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
          )}
          <div
            className={cn(
              'flex flex-1 flex-col gap-4 overflow-y-auto',
              !selectedItem?.path?.startsWith('app-') && 'p-4 pt-0',
            )}
          >
            <Routes>
              <Route
                index
                element={
                  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <h2 className="text-lg font-semibold mb-2">{t('title')}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t('selectCategory', {
                          defaultValue: 'Select a category from the sidebar to get started.',
                        })}
                      </p>
                    </div>
                  </div>
                }
              />
              {allRoutes.map((item) => (
                <Route
                  key={item.path}
                  path={item.path}
                  element={item.element}
                />
              ))}
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
