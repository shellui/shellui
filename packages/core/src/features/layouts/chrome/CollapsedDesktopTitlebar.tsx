import { SidebarTrigger, useSidebar } from '../../../components/ui/sidebar';
import { cn } from '../../../lib/utils';
import { DesktopHistoryButtons } from './DesktopHistoryButtons';
import { DESKTOP_TITLEBAR_HEIGHT_PX, DESKTOP_TITLEBAR_PAD_TOP_PX } from './constants';
import { MAC_DRAG_REGION_PROPS, MacLightsSafeArea, MacStripSpacer } from './MacStrip';
import { useIsTauriClient, useMacOverlayChrome } from './runtime';

/**
 * Full-width 32px macOS strip when the sidebar is collapsed in a Tauri overlay window:
 * lights safe area (80px, 12px in native fullscreen), expand trigger, Back, Forward,
 * then a drag spacer. Stays visible in native fullscreen.
 */
export function CollapsedDesktopTitlebar({ className }: { className?: string }) {
  const overlay = useMacOverlayChrome();
  const isTauriEnv = useIsTauriClient();
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  if (!overlay || !collapsed) return null;

  return (
    <div
      data-shellui-collapsed-titlebar=""
      data-shellui-mac-strip=""
      {...MAC_DRAG_REGION_PROPS}
      className={cn(
        'fixed inset-x-0 top-0 z-[47] flex w-full items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground select-none',
        className,
      )}
      style={{
        height: DESKTOP_TITLEBAR_HEIGHT_PX,
        paddingTop: DESKTOP_TITLEBAR_PAD_TOP_PX,
      }}
    >
      <MacLightsSafeArea />
      <div
        data-shellui-no-drag=""
        className="flex h-full items-center gap-0.5"
      >
        <SidebarTrigger className="size-6 touch-manipulation" />
        {isTauriEnv ? <DesktopHistoryButtons strip /> : null}
      </div>
      <MacStripSpacer />
    </div>
  );
}
