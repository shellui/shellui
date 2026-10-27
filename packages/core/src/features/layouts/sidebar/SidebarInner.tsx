import { useTranslation } from 'react-i18next';
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
import { MacLightsSafeArea, MacStripSpacer } from '../chrome/MacStrip';
import { DesktopHistoryButtons } from '../chrome/DesktopHistoryButtons';
import { useIsTauriClient, useMacOverlayChrome, useMacTrafficLights } from '../chrome/runtime';
import {
  DESKTOP_TITLEBAR_HEIGHT_PX,
  DESKTOP_TITLEBAR_PAD_TOP_PX,
  MAC_LIGHTS_SAFE_PX,
  SHELL_HEADER_HEIGHT_PX,
  SHELL_HEADER_PAD_TOP_PX,
} from '../chrome/constants';
import { AppBrandIcon } from '../branding/AppBrandIcon';

/** Reusable sidebar inner: header, main nav, footer. Used in desktop Sidebar and mobile Sheet. */
export function SidebarInner({
  startNav,
  endItems,
  showAuthButton,
  title,
  appIcon,
  inset = false,
}: {
  startNav: (NavigationItem | NavigationGroup)[];
  endItems: (NavigationItem | NavigationGroup)[];
  showAuthButton: boolean;
  title?: string;
  appIcon?: ThemeAsset;
  /** Sidebar-inset: the column is padded, so the title row must break out to meet the lights. */
  inset?: boolean;
}) {
  const { t } = useTranslation();
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
  const mobileTrafficInset = mobileSheetHeader ? MAC_LIGHTS_SAFE_PX : undefined;
  // Keep trigger on the right whenever an icon is configured (even while collapsed),
  // so it rides the sidebar width animation instead of jumping left.
  const hasAppIcon = Boolean(appIcon);

  const brandIcon = hasAppIcon ? (
    <AppBrandIcon
      appIcon={appIcon}
      title={title}
      data-shellui-no-drag=""
      className={cn(
        'w-5 min-w-0 shrink-0 overflow-hidden transition-[width,opacity,margin] duration-200 ease-linear',
        // macOS strip: the icon starts right at the 80px safe area edge.
        showOverlayHeader ? 'ml-0' : 'ml-1',
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
          // Always pin to titlebar height — default SidebarHeader p-2 is taller on web.
          'gap-0 border-b border-sidebar-border select-none',
          showOverlayHeader || mobileSheetHeader ? 'p-0' : 'px-2 py-0',
          showCollapsedTopBar && 'hidden',
          // Inset `p-3` sits this row 12px under the lights. Pull it to the window edge.
          inset && showOverlayHeader && '-mt-3 -ml-3 w-[calc(100%+1.5rem)]',
        )}
        style={{
          // macOS: the header is the 32px strip. Web, phones and caption bar hosts: 42px.
          height: showOverlayHeader ? DESKTOP_TITLEBAR_HEIGHT_PX : SHELL_HEADER_HEIGHT_PX,
          paddingTop: showOverlayHeader ? DESKTOP_TITLEBAR_PAD_TOP_PX : SHELL_HEADER_PAD_TOP_PX,
          ...(mobileSheetHeader ? { paddingLeft: mobileTrafficInset } : {}),
        }}
        {...(showOverlayHeader
          ? {
              'data-shellui-drag-region': '',
              'data-tauri-drag-region': '',
              'data-shellui-mac-strip': '',
            }
          : {})}
      >
        {showOverlayHeader ? (
          <div
            className="flex h-full w-full shrink-0 items-stretch"
            data-shellui-drag-region=""
            data-tauri-drag-region=""
          >
            {/* 80px drag-only safe area next to the lights (12px in native fullscreen). */}
            <MacLightsSafeArea />
            <div className="flex h-full min-w-0 flex-1 items-center gap-1">
              {hasAppIcon ? brandIcon : null}
              {!hasAppIcon ? (
                <SidebarTrigger
                  data-shellui-no-drag=""
                  className="size-6 shrink-0 touch-manipulation"
                />
              ) : null}
              <MacStripSpacer className="min-w-[8px]" />
              {isTauriEnv ? (
                <DesktopHistoryButtons
                  strip
                  className="self-center"
                />
              ) : null}
              {hasAppIcon ? (
                <SidebarTrigger
                  data-shellui-no-drag=""
                  className="size-6 shrink-0 touch-manipulation"
                />
              ) : null}
              {hasAppIcon ? trailingInset : null}
            </div>
          </div>
        ) : (
          <div className={cn('flex h-full w-full items-center', hasAppIcon ? 'gap-0' : 'gap-0.5')}>
            {brandIcon}
            {hasAppIcon ? (
              <div
                aria-hidden
                className="min-w-0 flex-1"
              />
            ) : null}
            <SidebarTrigger className="size-7 shrink-0 touch-manipulation" />
            {trailingInset}
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="shellui-nav gap-1">
        <nav
          aria-label={t('shellChrome.mainNav')}
          className="flex min-w-0 flex-col gap-1"
        >
          <NavigationContent navigation={startNav} />
        </nav>
      </SidebarContent>
      <SidebarFooter
        data-shellui-nav-footer=""
        className="shellui-nav gap-0 border-t border-sidebar-border px-0 pt-0 pb-[max(0.5rem,var(--shellui-safe-area-bottom))]"
      >
        {(endItems.length > 0 || showAuthButton) && (
          <nav
            aria-label={t('shellChrome.accountNav')}
            className="flex min-w-0 flex-col"
          >
            <NavigationContent
              navigation={endItems}
              trailing={showAuthButton ? <LoginButton variant="sidebar" /> : undefined}
            />
          </nav>
        )}
      </SidebarFooter>
    </>
  );
}
