import type { NavigationItem, NavigationGroup } from '../../config/types';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
} from '../../../components/ui/sidebar';
import { NavigationContent } from './NavigationContent';
import { LoginButton } from '../../auth/components/LoginButton';

/** Reusable sidebar inner: header, main nav, footer. Used in desktop Sidebar and mobile Sheet. */
export function SidebarInner({
  startNav,
  endItems,
  showAuthButton,
}: {
  startNav: (NavigationItem | NavigationGroup)[];
  endItems: (NavigationItem | NavigationGroup)[];
  showAuthButton: boolean;
}) {
  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border select-none">
        <SidebarTrigger className="size-8 touch-manipulation" />
      </SidebarHeader>
      <SidebarContent className="gap-1">
        <NavigationContent navigation={startNav} />
      </SidebarContent>
      <SidebarFooter className="gap-0 border-t border-sidebar-border p-0">
        {(endItems.length > 0 || showAuthButton) && (
          <NavigationContent
            navigation={endItems}
            trailing={showAuthButton ? <LoginButton variant="sidebar" /> : undefined}
          />
        )}
      </SidebarFooter>
    </>
  );
}
