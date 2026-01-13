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
import {
  BellIcon,
  MenuIcon,
  HomeIcon,
  PaintbrushIcon,
  MessageCircleIcon,
  GlobeIcon,
  KeyboardIcon,
  CheckIcon,
  VideoIcon,
  LinkIcon,
  LockIcon,
  SettingsIcon,
} from "./SettingsIcons"
import { Link, useLocation } from "react-router"

const data = {
  nav: [
    { name: "Notifications", icon: BellIcon, path: "notifications" },
    { name: "Navigation", icon: MenuIcon, path: "navigation" },
    { name: "Home", icon: HomeIcon, path: "home" },
    { name: "Appearance", icon: PaintbrushIcon, path: "appearance" },
    { name: "Messages & media", icon: MessageCircleIcon, path: "messages-and-media" },
    { name: "Language & region", icon: GlobeIcon, path: "language-and-region" },
    { name: "Accessibility", icon: KeyboardIcon, path: "accessibility" },
    { name: "Mark as read", icon: CheckIcon, path: "mark-as-read" },
    { name: "Audio & video", icon: VideoIcon, path: "audio-and-video" },
    { name: "Connected accounts", icon: LinkIcon, path: "connected-accounts" },
    { name: "Privacy & visibility", icon: LockIcon, path: "privacy-and-visibility" },
    { name: "Advanced", icon: SettingsIcon, path: "advanced" },
  ],
}

export const SettingsView = () => {
  const location = useLocation()
  
  // Find matching nav item by checking if URL contains or ends with the item path
  const getSelectedItemFromUrl = () => {
    const pathname = location.pathname
    
    // Find matching nav item by checking if pathname contains the item path
    // This works regardless of the URL structure/prefix
    const matchedItem = data.nav.find(item => {
      // Normalize paths for comparison (remove leading/trailing slashes)
      const normalizedPathname = pathname.replace(/^\/+|\/+$/g, '')
      const normalizedItemPath = item.path.replace(/^\/+|\/+$/g, '')
      
      // Check if pathname ends with the item path, or contains it as a path segment
      return normalizedPathname === normalizedItemPath ||
             normalizedPathname.endsWith(`/${normalizedItemPath}`) ||
             normalizedPathname.includes(`/${normalizedItemPath}/`)
    })
    
    return matchedItem?.name || "Messages & media"
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
                  {data.nav.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.name === selectedItem}
                        onClick={() => setSelectedItem(item.name)}
                      >
                        <Link to={`${item.path}`}>
                          <item.icon />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
            <div className="flex items-center gap-2 px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedItem}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted/50 aspect-video max-w-3xl rounded-xl"
              />
            ))}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
