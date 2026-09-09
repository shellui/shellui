import { SidebarTrigger, useSidebar } from '../../../components/ui/sidebar';
import { cn } from '../../../lib/utils';
import { DesktopHistoryButtons } from './DesktopHistoryButtons';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  DESKTOP_TITLEBAR_PAD_TOP_PX,
  MAC_TRAFFIC_LIGHTS_GAP_PX,
  MAC_TRAFFIC_LIGHTS_WIDTH_PX,
} from './constants';
import { useIsTauriClient, useMacOverlayChrome, useMacTrafficLights } from './runtime';

/**
 * Full-width 42px chrome when the sidebar is collapsed in a Tauri overlay window.
 * Open-sidebar first, then Back; room for more controls later.
 * Stays visible in native fullscreen (no traffic-light spacer there).
 */
export function CollapsedDesktopTitlebar({ className }: { className?: string }) {
  const overlay = useMacOverlayChrome();
  const trafficLights = useMacTrafficLights();
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
      style={{
        height: DESKTOP_TITLEBAR_HEIGHT_PX,
        paddingTop: DESKTOP_TITLEBAR_PAD_TOP_PX,
      }}
    >
      {trafficLights ? (
        <div
          className="h-full shrink-0"
          style={{ width: MAC_TRAFFIC_LIGHTS_WIDTH_PX }}
          aria-hidden
        />
      ) : null}
      <div
        data-shellui-no-drag=""
        className="flex h-full items-center gap-0.5"
        style={{ paddingLeft: trafficLights ? MAC_TRAFFIC_LIGHTS_GAP_PX : 8 }}
      >
        <SidebarTrigger className="size-7 touch-manipulation" />
        {isTauriEnv ? <DesktopHistoryButtons /> : null}
      </div>
    </div>
  );
}
