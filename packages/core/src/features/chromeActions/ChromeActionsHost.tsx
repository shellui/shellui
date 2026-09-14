import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHROME_ACTIONS_VISIBLE_TRAILING, shellui, type ChromeActionsPayload } from '@shellui/sdk';
import { cn } from '../../lib/utils';
import { useViewport } from '../../hooks/use-viewport';
import { useSettings } from '../settings/hooks/useSettings';
import { FLOATING_CHROME_MARGIN } from '../layouts/floating/computeFloatingInsets';
import { floatingTabBarBottomPadPx } from '../layouts/floating/computeFloatingInsets';
import { FLOATING_TAB_BAR_HEIGHT } from '../layouts/floating/computeFloatingInsets';
import { useChromeActionsSnapshot } from './ChromeActionsProvider';
import type { FrameChromeActions } from './chromeActionsStore';
import {
  CHROME_ACTIONS_FAB_GAP,
  CHROME_ACTIONS_FAB_SIZE,
  CHROME_ACTIONS_TOP_BAR_HEIGHT,
  actionChromeFlags,
} from './computeActionInsets';
import {
  ChevronLeftIcon,
  ChromeActionGlyph,
  MoreHorizontalIcon,
  PlusIcon,
} from './ChromeActionIcons';

function fireAction(frameUuid: string, id: string): void {
  shellui.sendMessage({
    type: 'SHELLUI_ACTION',
    payload: { id },
    to: [frameUuid],
  });
}

function iframeRect(frameUuid: string): DOMRect | null {
  for (const [uuid, iframe] of shellui.frameRegistry.getAllIframes()) {
    if (uuid === frameUuid && iframe.isConnected) {
      return iframe.getBoundingClientRect();
    }
  }
  return null;
}

function ActionButton({
  item,
  frameUuid,
  compact,
  className,
}: {
  item: { id: string; label?: string; icon?: string };
  frameUuid: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors',
        'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact && 'px-1.5',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        fireAction(frameUuid, item.id);
      }}
      aria-label={item.label || item.icon || item.id}
    >
      {item.icon ? (
        <ChromeActionGlyph
          icon={item.icon}
          label={item.label}
          className="size-5 shrink-0"
        />
      ) : null}
      {item.label && !compact ? <span className="max-w-[7rem] truncate">{item.label}</span> : null}
      {item.label && compact && !item.icon ? (
        <span className="max-w-[5rem] truncate text-xs">{item.label}</span>
      ) : null}
    </button>
  );
}

function TopActionBar({
  actions,
  placement,
}: {
  actions: FrameChromeActions;
  placement: 'overlay' | 'titlebar';
}) {
  const viewport = useViewport();
  const [moreOpen, setMoreOpen] = useState(false);
  const narrow = viewport === 'mobile' || viewport === 'tablet';
  const trailing = actions.trailing ?? [];
  // Desktop: ≤3 visible; mobile/tablet: all trailing collapse into ···.
  const maxVisible = narrow ? 0 : CHROME_ACTIONS_VISIBLE_TRAILING;
  const visible = trailing.slice(0, maxVisible);
  const overflow = trailing.slice(maxVisible);
  const showMore = overflow.length > 0 || (narrow && trailing.length > 0);
  const moreItems = narrow ? trailing : overflow;

  useEffect(() => {
    setMoreOpen(false);
  }, [actions.frameUuid, actions.title, trailing.length]);

  const flags = actionChromeFlags(actions);
  if (!flags.hasTop) return null;

  return (
    <div
      data-shellui-chrome-actions-top={placement}
      className={cn(
        'pointer-events-auto flex items-center gap-1',
        placement === 'overlay' && 'shellui-floating-glass absolute left-3 right-3 z-[46] px-1.5',
        placement === 'titlebar' && 'min-w-0 flex-1',
      )}
      style={
        placement === 'overlay'
          ? {
              top: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-top, 0px))`,
              height: CHROME_ACTIONS_TOP_BAR_HEIGHT,
            }
          : undefined
      }
    >
      {actions.back ? (
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={actions.back.label || 'Back'}
          onClick={(e) => {
            e.stopPropagation();
            fireAction(actions.frameUuid, actions.back!.id);
          }}
        >
          {actions.back.icon && actions.back.icon !== 'back' ? (
            <ChromeActionGlyph
              icon={actions.back.icon}
              label={actions.back.label}
            />
          ) : (
            <ChevronLeftIcon />
          )}
        </button>
      ) : (
        <span className="size-2 shrink-0" />
      )}

      {actions.title ? (
        <span
          className={cn(
            'min-w-0 flex-1 truncate px-1 text-sm font-semibold text-sidebar-foreground',
            placement === 'titlebar' && 'text-foreground',
          )}
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {actions.title}
        </span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}

      <div className="relative flex shrink-0 items-center gap-0.5">
        {visible.map((item) => (
          <ActionButton
            key={item.id}
            item={item}
            frameUuid={actions.frameUuid}
            compact={placement === 'titlebar'}
          />
        ))}
        {showMore ? (
          <>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="More actions"
              onClick={(e) => {
                e.stopPropagation();
                setMoreOpen((v) => !v);
              }}
            >
              <MoreHorizontalIcon />
            </button>
            {moreOpen ? (
              <>
                <div
                  aria-hidden
                  className="fixed inset-0 z-[47] cursor-pointer"
                  style={{ backgroundColor: 'rgba(0,0,0,0.001)' }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setMoreOpen(false);
                  }}
                />
                <div
                  role="menu"
                  className="shellui-floating-glass shellui-floating-glass-menu absolute right-0 top-[calc(100%+0.35rem)] z-[48] flex min-w-[10rem] max-w-[min(16rem,calc(100vw-1.5rem))] flex-col gap-0.5 p-1.5 shadow-lg"
                >
                  {moreItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoreOpen(false);
                        fireAction(actions.frameUuid, item.id);
                      }}
                    >
                      <ChromeActionGlyph
                        icon={item.icon}
                        label={item.label}
                        className="size-4 shrink-0"
                      />
                      <span className="truncate">{item.label || item.id}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function PrimaryFab({
  actions,
  bottomOffset,
}: {
  actions: FrameChromeActions;
  bottomOffset: number;
}) {
  if (!actions.primary) return null;
  const item = actions.primary;

  return (
    <button
      type="button"
      data-shellui-chrome-actions-fab=""
      className={cn(
        'shellui-floating-glass pointer-events-auto absolute z-[46] inline-flex items-center justify-center rounded-full text-sidebar-primary-foreground',
        'bg-sidebar-primary text-sidebar-primary-foreground shadow-md',
        'hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      style={{
        width: CHROME_ACTIONS_FAB_SIZE,
        height: CHROME_ACTIONS_FAB_SIZE,
        right: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-right, 0px))`,
        bottom: bottomOffset,
      }}
      aria-label={item.label || item.icon || 'Primary action'}
      onClick={(e) => {
        e.stopPropagation();
        fireAction(actions.frameUuid, item.id);
      }}
    >
      {item.icon ? (
        <ChromeActionGlyph
          icon={item.icon}
          label={item.label}
          className="size-6"
        />
      ) : item.label ? (
        <span className="px-1 text-sm font-semibold">{item.label}</span>
      ) : (
        <PlusIcon className="size-6" />
      )}
    </button>
  );
}

function FrameActionsOverlay({
  actions,
  showTop,
  fabBottomOffset,
}: {
  actions: FrameChromeActions;
  showTop: boolean;
  fabBottomOffset: number;
}) {
  const [rect, setRect] = useState<DOMRect | null>(() => iframeRect(actions.frameUuid));

  const refresh = useCallback(() => {
    setRect(iframeRect(actions.frameUuid));
  }, [actions.frameUuid]);

  useEffect(() => {
    refresh();
    const onResize = () => refresh();
    window.addEventListener('resize', onResize);
    const id = window.setInterval(refresh, 500);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearInterval(id);
    };
  }, [refresh]);

  if (!rect || rect.width < 8 || rect.height < 8) return null;

  return (
    <div
      data-shellui-chrome-actions-frame={actions.frameUuid}
      className="pointer-events-none fixed z-[46]"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      {showTop ? (
        <TopActionBar
          actions={actions}
          placement="overlay"
        />
      ) : null}
      <PrimaryFab
        actions={actions}
        bottomOffset={fabBottomOffset}
      />
    </div>
  );
}

/**
 * Host chrome for SDK floating actions — top bar + bottom FAB, positioned
 * over each content iframe that has declared actions.
 */
export function ChromeActionsHost() {
  const all = useChromeActionsSnapshot();
  const { settings } = useSettings();
  const viewport = useViewport();
  const windowsLayout = settings.layout === 'windows';

  const fabBottomOffset = useMemo(() => {
    const safeBottom = 0; // CSS var applied in style; numeric pad for tab bar
    const floating =
      settings.layout === 'floating' && (viewport === 'mobile' || viewport === 'tablet');
    if (floating) {
      return (
        floatingTabBarBottomPadPx(safeBottom, viewport) +
        FLOATING_TAB_BAR_HEIGHT +
        CHROME_ACTIONS_FAB_GAP
      );
    }
    return FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_GAP;
  }, [settings.layout, viewport]);

  if (all.length === 0) return null;

  return (
    <>
      {all.map((actions) => (
        <FrameActionsOverlay
          key={actions.frameUuid}
          actions={actions}
          showTop={!windowsLayout}
          fabBottomOffset={
            windowsLayout ? FLOATING_CHROME_MARGIN + CHROME_ACTIONS_FAB_GAP : fabBottomOffset
          }
        />
      ))}
    </>
  );
}

/** Compact top actions for a windows-layout title bar. */
export function WindowTitleBarActions({
  frameUuid,
  fallbackTitle,
}: {
  frameUuid: string | null;
  fallbackTitle?: string;
}) {
  const all = useChromeActionsSnapshot();
  const actions = useMemo(
    () => (frameUuid ? (all.find((a) => a.frameUuid === frameUuid) ?? null) : null),
    [all, frameUuid],
  );
  if (actions && actionChromeFlags(actions).hasTop) {
    const withTitle: FrameChromeActions = actions.title
      ? actions
      : { ...actions, title: fallbackTitle };
    return (
      <TopActionBar
        actions={withTitle}
        placement="titlebar"
      />
    );
  }
  if (fallbackTitle) {
    return <span className="flex-1 text-sm font-medium truncate min-w-0">{fallbackTitle}</span>;
  }
  return <span className="min-w-0 flex-1" />;
}

export type { ChromeActionsPayload };
