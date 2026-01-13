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

const data = {
  nav: [
    { name: "Notifications", icon: BellIcon },
    { name: "Navigation", icon: MenuIcon },
    { name: "Home", icon: HomeIcon },
    { name: "Appearance", icon: PaintbrushIcon },
    { name: "Messages & media", icon: MessageCircleIcon },
    { name: "Language & region", icon: GlobeIcon },
    { name: "Accessibility", icon: KeyboardIcon },
    { name: "Mark as read", icon: CheckIcon },
    { name: "Audio & video", icon: VideoIcon },
    { name: "Connected accounts", icon: LinkIcon },
    { name: "Privacy & visibility", icon: LockIcon },
    { name: "Advanced", icon: SettingsIcon },
  ],
}

export const SettingsView = () => {
  const [selectedItem, setSelectedItem] = React.useState("Messages & media")

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
                        <a href="#" onClick={(e) => e.preventDefault()}>
                          <item.icon />
                          <span>{item.name}</span>
                        </a>
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
