import { Link } from 'react-router';
import type { NavigationItem, NavigationGroup } from '../../config/types';
import { SidebarHeader, SidebarContent, SidebarFooter } from '../../../components/ui/sidebar';
import { NavigationContent } from './NavigationContent';
import { LayoutAuthButton } from '../../auth/components/LayoutAuthButton';

/** Reusable sidebar inner: header, main nav, footer. Used in desktop Sidebar and mobile Drawer. */
export function SidebarInner({
  title,
  logo,
  startNav,
  endItems,
  showAuthButton,
}: {
  title?: string;
  logo?: string;
  startNav: (NavigationItem | NavigationGroup)[];
  endItems: (NavigationItem | NavigationGroup)[];
  showAuthButton: boolean;
}) {
  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border pb-4">
        {(title || logo) && (
          <Link
            to="/"
            className="flex items-center pl-1 pr-3 py-2 text-lg font-semibold text-sidebar-foreground hover:text-sidebar-foreground/80 transition-colors"
          >
            {logo && logo.trim() ? (
              <img
                src={logo}
                alt={title || 'Logo'}
                className="h-5 w-auto shrink-0 object-contain sidebar-logo"
              />
            ) : title ? (
              <span className="leading-none">{title}</span>
            ) : null}
          </Link>
        )}
      </SidebarHeader>
      <SidebarContent className="gap-1">
        <NavigationContent navigation={startNav} />
      </SidebarContent>
      <SidebarFooter>
        {endItems.length > 0 && <NavigationContent navigation={endItems} />}
        {showAuthButton && <LayoutAuthButton variant="sidebar" />}
      </SidebarFooter>
    </>
  );
}
