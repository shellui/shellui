import { SidebarTrigger, useSidebar } from '../../../components/ui/sidebar';
import { cn } from '../../../lib/utils';
import { DesktopBackButton } from './DesktopBackButton';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
} from './constants';
import { useIsTauriClient, useMacOverlayChrome } from './runtime';

/**
 * Full-width 38px chrome when the sidebar is collapsed in a Tauri overlay window.
 * Open-sidebar first, then Back; room for more controls later.
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
      data-shellui-drag-region=""
      data-tauri-drag-region=""
      className={cn(
        'fixed inset-x-0 top-0 z-[47] flex w-full items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground select-none',
        className,
      )}
      style={{ height: DESKTOP_TITLEBAR_HEIGHT_PX }}
    >
      <div
        className="h-full shrink-0"
        style={{ width: MAC_TRAFFIC_LIGHTS_WIDTH_PX }}
        aria-hidden
      />
      <div
        data-shellui-no-drag=""
        className="flex h-full items-center gap-0.5"
        style={{ paddingLeft: MAC_TRAFFIC_LIGHTS_GAP_PX }}
      >
        <SidebarTrigger className="size-8 touch-manipulation" />
        {isTauriEnv ? <DesktopBackButton /> : null}
      </div>
    </div>
  );
}
