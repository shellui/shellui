import { Link, useLocation, Outlet } from 'react-router-dom';
import type { NavigationItem } from '../config/types';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface DefaultLayoutProps {
  title?: string;
  navigation: NavigationItem[];
}

export const DefaultLayout = ({ title, navigation }: DefaultLayoutProps) => {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar>
        {title && (
          <SidebarHeader className="border-b border-sidebar-border pb-4">
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              {title}
            </h1>
          </SidebarHeader>
        )}
        
        <SidebarContent>
          <SidebarMenu>
            {navigation.map((item) => {
              const isActive = location.pathname === `/${item.path}`;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={cn(
                      "w-full justify-start",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <Link to={`/${item.path}`}>
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <Outlet />
      </main>
    </div>
  );
};
