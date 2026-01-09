import { Link, useLocation, Outlet } from 'react-router-dom';
import { useMemo } from 'react';
import type { NavigationItem } from '../config/types';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { getIconComponent } from '@/components/Icon';

interface DefaultLayoutProps {
  title?: string;
  navigation: NavigationItem[];
}


const NavigationContent = ({ navigation }: { navigation: NavigationItem[] }) => {
  const location = useLocation();

  // Check if at least one navigation item has an icon
  const hasAnyIcons = useMemo(() => {
    return navigation.some(item => getIconComponent(item.icon) !== null);
  }, [navigation]);

  // Memoize icon components to prevent recreation on every render
  const iconComponents = useMemo(() => {
    const components = new Map<string, ReturnType<typeof getIconComponent>>();
    navigation.forEach(item => {
      if (item.icon) {
        components.set(item.path, getIconComponent(item.icon));
      }
    });
    return components;
  }, [navigation]);

  return (
    <SidebarMenu>
      {navigation.map((item) => {
        const pathPrefix = `/${item.path}`;
        const isActive = location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`);
        const IconComponent = iconComponents.get(item.path);
        
        return (
          <SidebarMenuItem key={item.path}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className={cn(
                "w-full",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <Link to={`/${item.path}`} className="flex items-center gap-2 w-full">
                {IconComponent ? (
                  <IconComponent className="h-4 w-4 shrink-0" />
                ) : hasAnyIcons ? (
                  <span className="h-4 w-4 shrink-0" />
                ) : null}
                <span className="truncate">{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
};

export const DefaultLayout = ({ title, navigation }: DefaultLayoutProps) => {

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border pb-4">
            {title && (
              <Link to="/" className="text-lg font-semibold text-sidebar-foreground hover:text-sidebar-foreground/80 transition-colors">
                {title}
              </Link>
            )}
          </SidebarHeader>
          
          <SidebarContent>
            <NavigationContent navigation={navigation} />
          </SidebarContent>
        </Sidebar>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
          <div className="absolute top-4 left-4 z-[9999]">
            <SidebarTrigger />
          </div>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};
