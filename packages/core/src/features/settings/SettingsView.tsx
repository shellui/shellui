import * as React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Route, Routes, useLocation, useNavigate } from "react-router"
import { settingsRoutes } from "./SettingsRoutes"
import { useSettings } from "./SettingsContext"
import { Button } from "@/components/ui/button"
import { ChevronRightIcon, ChevronLeftIcon } from "./SettingsIcons"


export const SettingsView = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { settings } = useSettings()

  // Filter routes based on developer features setting
  const filteredRoutes = React.useMemo(() => {
    if (settings.developerFeatures.enabled) {
      return settingsRoutes
    }
    return settingsRoutes.filter(route => route.path !== "developpers")
  }, [settings.developerFeatures.enabled])

  // Find matching nav item by checking if URL contains or ends with the item path
  const getSelectedItemFromUrl = React.useCallback(() => {
    const pathname = location.pathname

    // Find matching nav item by checking if pathname contains the item path
    // This works regardless of the URL structure/prefix
    const matchedItem = filteredRoutes.find(item => {
      // Normalize paths for comparison (remove leading/trailing slashes)
      const normalizedPathname = pathname.replace(/^\/+|\/+$/g, '')
      const normalizedItemPath = item.path.replace(/^\/+|\/+$/g, '')

      // Check if pathname ends with the item path, or contains it as a path segment
      return normalizedPathname === normalizedItemPath ||
        normalizedPathname.endsWith(`/${normalizedItemPath}`) ||
        normalizedPathname.includes(`/${normalizedItemPath}/`)
    })

    return matchedItem
  }, [location.pathname, filteredRoutes])

  const selectedItem = React.useMemo(() => getSelectedItemFromUrl(), [getSelectedItemFromUrl])

  // Check if we're at the settings root (no specific route selected)
  const isSettingsRoot = React.useMemo(() => {
    const pathname = location.pathname.replace(/^\/+|\/+$/g, '')
    return !filteredRoutes.some(item => {
      const normalizedItemPath = item.path.replace(/^\/+|\/+$/g, '')
      return pathname === normalizedItemPath ||
        pathname.endsWith(`/${normalizedItemPath}`) ||
        pathname.includes(`/${normalizedItemPath}/`)
    })
  }, [location.pathname, filteredRoutes])

  // Navigate back to settings root
  const handleBackToSettings = React.useCallback(() => {
    // Extract the base settings path from current location
    // If we're at /__settings/notifications, go to /__settings
    const pathParts = location.pathname.split('/').filter(Boolean)
    const settingsIndex = pathParts.indexOf('__settings')
    if (settingsIndex !== -1) {
      const basePath = '/' + pathParts.slice(0, settingsIndex + 1).join('/')
      navigate(basePath)
    } else {
      // Fallback: navigate to /__settings directly
      navigate('/__settings')
    }
  }, [navigate, location.pathname])

  return (
    <SidebarProvider>
      <div className="flex h-full w-full overflow-hidden items-start">
        {/* Desktop Sidebar */}
        <Sidebar className="hidden md:flex">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredRoutes.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.name === selectedItem?.name}
                      >
                        <button onClick={() => navigate(`${item.path}`)} className="cursor-pointer">
                          <item.icon />
                          <span>{item.name}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Mobile List View */}
        <div className="md:hidden flex h-full w-full flex-col overflow-hidden">
          {isSettingsRoot ? (
            // Show list of settings pages
            <div className="flex flex-1 flex-col overflow-y-auto">
              <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
                <h1 className="text-lg font-semibold">Settings</h1>
              </header>
              <div className="flex flex-1 flex-col p-4 gap-2">
                {filteredRoutes.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={item.name}
                      variant="outline"
                      className="w-full justify-between h-auto py-4 px-4"
                      onClick={() => navigate(`${item.path}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Icon />
                        <span className="text-base font-medium">{item.name}</span>
                      </div>
                      <ChevronRightIcon />
                    </Button>
                  )
                })}
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
                  {filteredRoutes.map((item) => (
                    <Route key={item.path} path={item.path} element={item.element} />
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
                    <BreadcrumbItem>
                      Settings
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{selectedItem.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
          )}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
            <Routes>
              {filteredRoutes.map((item) => (
                <Route key={item.path} path={item.path} element={item.element} />
              ))}
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
