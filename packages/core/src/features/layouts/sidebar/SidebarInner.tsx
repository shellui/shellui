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
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
} from '../chrome/constants';

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
  // Collapsed Tauri: Back + trigger live in CollapsedDesktopTitlebar instead.
  const showCollapsedTopBar = overlay && collapsed;
  const showOverlayHeader = overlay && !collapsed;

  return (
    <>
      <SidebarHeader
        className={cn(
          'border-b border-sidebar-border select-none',
          showOverlayHeader && 'gap-0 p-0',
          showCollapsedTopBar && 'hidden',
        )}
        {...(showOverlayHeader
          ? { 'data-shellui-drag-region': '', 'data-tauri-drag-region': '' }
          : {})}
      >
        {showOverlayHeader ? (
          <div
            className="flex w-full shrink-0 items-stretch"
            style={{ height: DESKTOP_TITLEBAR_HEIGHT_PX }}
            data-shellui-drag-region=""
            data-tauri-drag-region=""
          >
            <div
              className="h-full shrink-0"
              style={{ width: MAC_TRAFFIC_LIGHTS_WIDTH_PX }}
              aria-hidden
            />
            <div
              className="flex h-full min-w-0 flex-1 items-stretch"
              style={{ paddingLeft: MAC_TRAFFIC_LIGHTS_GAP_PX }}
            >
              <SidebarTrigger
                data-shellui-no-drag=""
                className="size-8 shrink-0 self-center touch-manipulation"
              />
              <div
                aria-hidden
                data-shellui-drag-region=""
                data-tauri-drag-region=""
                className="min-h-full min-w-[8px] flex-1"
              />
              {isTauriEnv ? <DesktopBackButton className="shrink-0 self-center" /> : null}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {isTauriEnv ? <DesktopBackButton /> : null}
            <SidebarTrigger className="size-8 touch-manipulation" />
          </div>
        )}
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
