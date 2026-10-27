import { useTranslation } from 'react-i18next';
import type { NavigationItem, NavigationGroup, ThemeAsset } from '../../config/types';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '../../../components/ui/sidebar';
import { CloseIcon } from './SidebarIcons';
import { NavigationContent } from './NavigationContent';
import { ShellDivider } from '../../../components/ui/shell-divider';
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

/** Mobile sheet brand row height (spec: 52px). */
const MOBILE_SHEET_HEADER_HEIGHT_PX = 52;

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
  const { state, isMobile, setOpenMobile } = useSidebar();
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
          'gap-0 select-none',
          showOverlayHeader || mobileSheetHeader ? 'p-0' : 'px-2 py-0',
          // Mobile sheet: brand row with a close button, 14px left like the mock.
          isMobile && !mobileSheetHeader && 'pr-2 pl-3.5',
          showCollapsedTopBar && 'hidden',
          // Inset `p-3` sits this row 12px under the lights. Pull it to the window edge.
          inset && showOverlayHeader && '-mt-3 -ml-3 w-[calc(100%+1.5rem)]',
          // Web: same pull, so the brand row lines up with the plain sidebar header.
          inset && !showOverlayHeader && !isMobile && '-mt-3 -ml-3 w-[calc(100%+0.75rem)] pl-5',
        )}
        style={{
          // macOS: the header is the 32px strip. Web, phones and caption bar hosts: 42px.
          height: showOverlayHeader
            ? DESKTOP_TITLEBAR_HEIGHT_PX
            : isMobile
              ? MOBILE_SHEET_HEADER_HEIGHT_PX
              : SHELL_HEADER_HEIGHT_PX,
          paddingTop: showOverlayHeader
            ? DESKTOP_TITLEBAR_PAD_TOP_PX
            : isMobile
              ? 0
              : SHELL_HEADER_PAD_TOP_PX,
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
        ) : isMobile ? (
          <div className="flex h-full w-full items-center gap-1.5">
            {brandIcon}
            <span
              aria-hidden
              className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground"
            >
              {title}
            </span>
            <button
              type="button"
              aria-label={t('shellChrome.closeMenu')}
              onClick={() => setOpenMobile(false)}
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--shellui-r-row)] text-[var(--shellui-nav-icon)] hover:bg-[var(--shellui-nav-hover)] hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-[var(--sidebar-ring)]"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
        ) : (
          <div className={cn('flex h-full w-full items-center', hasAppIcon ? 'gap-0' : 'gap-0.5')}>
            {brandIcon}
            {hasAppIcon ? (
              <div
                aria-hidden
                className="min-w-0 flex-1 overflow-hidden"
              >
                {title ? (
                  <span className="block truncate pl-2 text-sm font-semibold text-sidebar-foreground transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                    {title}
                  </span>
                ) : null}
              </div>
            ) : null}
            <SidebarTrigger className="size-7 shrink-0 touch-manipulation" />
            {trailingInset}
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="shellui-nav gap-0">
        <nav
          aria-label={t('shellChrome.mainNav')}
          className="flex min-w-0 flex-col gap-0.5 py-2"
        >
          <NavigationContent navigation={startNav} />
        </nav>
      </SidebarContent>
      <SidebarFooter
        data-shellui-nav-footer=""
        className="shellui-nav gap-0 px-0 pt-0 pb-[max(0.5rem,var(--shellui-safe-area-bottom))]"
      >
        <ShellDivider data-shellui-footer-divider="" />
        {(endItems.length > 0 || showAuthButton) && (
          <nav
            aria-label={t('shellChrome.accountNav')}
            className="flex min-w-0 flex-col gap-0.5 pt-1.5 pb-1"
          >
            <NavigationContent
              navigation={endItems}
              trailing={
                showAuthButton ? (
                  <LoginButton
                    variant="sidebar"
                    dividerAbove={endItems.length > 0}
                  />
                ) : undefined
              }
            />
          </nav>
        )}
      </SidebarFooter>
    </>
  );
}
