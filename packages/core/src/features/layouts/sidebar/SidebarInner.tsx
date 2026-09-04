import type { NavigationItem, NavigationGroup, ThemeAsset } from '../../config/types';
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
import { DesktopHistoryButtons } from '../chrome/DesktopHistoryButtons';
import { useIsTauriClient, useMacOverlayChrome, useMacTrafficLights } from '../chrome/runtime';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
} from '../chrome/constants';
import { AppBrandIcon } from '../branding/AppBrandIcon';

/** Reusable sidebar inner: header, main nav, footer. Used in desktop Sidebar and mobile Sheet. */
export function SidebarInner({
  startNav,
  endItems,
  showAuthButton,
  title,
  appIcon,
}: {
  startNav: (NavigationItem | NavigationGroup)[];
  endItems: (NavigationItem | NavigationGroup)[];
  showAuthButton: boolean;
  title?: string;
  appIcon?: ThemeAsset;
}) {
  const isTauriEnv = useIsTauriClient();
  const overlay = useMacOverlayChrome();
  const trafficLights = useMacTrafficLights();
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  // Collapsed Tauri: Back + trigger live in CollapsedDesktopTitlebar instead.
  const showCollapsedTopBar = overlay && collapsed;
  const showOverlayHeader = overlay && !collapsed;
  // Narrow Tauri window: sheet header must clear native traffic lights.
  const mobileSheetHeader = isMobile && trafficLights;
  const mobileTrafficInset = mobileSheetHeader
    ? MAC_TRAFFIC_LIGHTS_WIDTH_PX + MAC_TRAFFIC_LIGHTS_GAP_PX
    : undefined;
  // Keep trigger on the right whenever an icon is configured (even while collapsed),
  // so it rides the sidebar width animation instead of jumping left.
  const hasAppIcon = Boolean(appIcon);

  const brandIcon = hasAppIcon ? (
    <AppBrandIcon
      appIcon={appIcon}
      title={title}
      data-shellui-no-drag=""
      className={cn(
        'ml-1 w-5 min-w-0 shrink-0 overflow-hidden transition-[width,opacity,margin] duration-200 ease-linear',
        // Sync with sidebar collapse; icon fades/shrinks while trigger stays put.
        'group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0',
      )}
      imgClassName="sidebar-app-icon"
    />
  ) : null;

  // Right twin of the logo's ml-1. When collapsed it grows so the trigger stays centered
  // with the nav icons (same role as the left flex-1 spacer when expanded).
  const trailingInset = hasAppIcon ? (
    <div
      aria-hidden
      className="w-1 shrink-0 transition-[flex-grow,width] duration-200 ease-linear group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex-1"
    />
  ) : null;

  return (
    <>
      <SidebarHeader
        className={cn(
          'border-b border-sidebar-border select-none',
          showOverlayHeader && 'gap-0 p-0',
          showCollapsedTopBar && 'hidden',
          mobileSheetHeader && 'gap-0 p-0',
        )}
        style={
          mobileSheetHeader
            ? {
                height: DESKTOP_TITLEBAR_HEIGHT_PX,
                paddingLeft: mobileTrafficInset,
              }
            : undefined
        }
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
              className="flex h-full min-w-0 flex-1 items-center gap-1"
              style={{ paddingLeft: MAC_TRAFFIC_LIGHTS_GAP_PX }}
            >
              {hasAppIcon ? brandIcon : null}
              {!hasAppIcon ? (
                <SidebarTrigger
                  data-shellui-no-drag=""
                  className="size-8 shrink-0 touch-manipulation"
                />
              ) : null}
              <div
                aria-hidden
                data-shellui-drag-region=""
                data-tauri-drag-region=""
                className="min-h-full min-w-[8px] flex-1 self-stretch"
              />
              {isTauriEnv ? <DesktopHistoryButtons className="self-center" /> : null}
              {hasAppIcon ? (
                <SidebarTrigger
                  data-shellui-no-drag=""
                  className="size-8 shrink-0 touch-manipulation"
                />
              ) : null}
              {hasAppIcon ? trailingInset : null}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex w-full items-center',
              hasAppIcon ? 'gap-0' : 'gap-0.5',
              mobileSheetHeader && 'h-full',
            )}
          >
            {brandIcon}
            {hasAppIcon ? (
              <div
                aria-hidden
                className="min-w-0 flex-1"
              />
            ) : null}
            <SidebarTrigger className="size-8 shrink-0 touch-manipulation" />
            {trailingInset}
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
