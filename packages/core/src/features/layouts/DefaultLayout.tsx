import { Link, useLocation, Outlet } from 'react-router-dom';
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

interface DefaultLayoutProps {
  title?: string;
  navigation: NavigationItem[];
}

const NavigationContent = ({ navigation }: { navigation: NavigationItem[] }) => {
  const location = useLocation();

  return (
    <SidebarMenu>
      {navigation.map((item) => {
        const pathPrefix = `/${item.path}`;
        const isActive = location.pathname === pathPrefix || location.pathname.startsWith(`${pathPrefix}/`);
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
