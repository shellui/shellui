import type { NavigationItem, NavigationGroup } from '../../config/types';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '../../../components/ui/sidebar';
import { NavigationContent } from './NavigationContent';
import { LoginButton } from '../../auth/components/LoginButton';
import { cn } from '../../../lib/utils';
import { DesktopBackButton } from '../chrome/DesktopBackButton';
import { useIsTauriClient, useMacOverlayChrome } from '../chrome/runtime';
import { DESKTOP_TITLEBAR_HEIGHT_PX, MAC_TRAFFIC_LIGHTS_WIDTH_PX } from '../chrome/constants';

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
  const isTauriEnv = useIsTauriClient();
  const overlay = useMacOverlayChrome();
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  const controls = (
    <div
      data-shellui-no-drag=""
      className={cn('flex items-center gap-0.5', overlay && collapsed && 'w-full flex-col p-2')}
    >
      {isTauriEnv ? <DesktopBackButton /> : null}
      <SidebarTrigger className="size-8 touch-manipulation" />
    </div>
  );

  return (
    <>
      <SidebarHeader
        className={cn('border-b border-sidebar-border select-none', overlay && 'gap-0 p-0')}
        {...(overlay ? { 'data-shellui-drag-region': '', 'data-tauri-drag-region': '' } : {})}
      >
        {overlay ? (
          <div
            className="flex shrink-0 items-center"
            style={{ height: DESKTOP_TITLEBAR_HEIGHT_PX }}
            data-shellui-drag-region=""
            data-tauri-drag-region=""
          >
            <div
              className="h-full shrink-0"
              style={{ width: collapsed ? '100%' : MAC_TRAFFIC_LIGHTS_WIDTH_PX }}
            />
            {collapsed ? null : controls}
          </div>
        ) : null}
        {!overlay || collapsed ? controls : null}
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
