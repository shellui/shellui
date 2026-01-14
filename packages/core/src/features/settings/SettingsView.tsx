import * as React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
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


export const SettingsView = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Find matching nav item by checking if URL contains or ends with the item path
  const getSelectedItemFromUrl = () => {
    const pathname = location.pathname
    
    // Find matching nav item by checking if pathname contains the item path
    // This works regardless of the URL structure/prefix
    const matchedItem = settingsRoutes.find(item => {
      // Normalize paths for comparison (remove leading/trailing slashes)
      const normalizedPathname = pathname.replace(/^\/+|\/+$/g, '')
      const normalizedItemPath = item.path.replace(/^\/+|\/+$/g, '')
      
      // Check if pathname ends with the item path, or contains it as a path segment
      return normalizedPathname === normalizedItemPath ||
             normalizedPathname.endsWith(`/${normalizedItemPath}`) ||
             normalizedPathname.includes(`/${normalizedItemPath}/`)
    })
    
    return matchedItem?.name
  }
  
  const [selectedItem, setSelectedItem] = React.useState(() => getSelectedItemFromUrl())
  
  // Update selectedItem when URL changes
  React.useEffect(() => {
    setSelectedItem(getSelectedItemFromUrl())
  }, [location.pathname])

  return (
    <SidebarProvider>
      <div className="flex h-full w-full overflow-hidden items-start">
        <Sidebar className="hidden md:flex">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsRoutes.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.name === selectedItem}
                        onClick={() => setSelectedItem(item.name)}
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
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          { selectedItem && <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
            <div className="flex items-center gap-2 px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    Settings
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedItem}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
            <Routes>
              {settingsRoutes.map((item) => (
                <Route key={item.path} path={item.path} element={item.element} />
              ))}
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
