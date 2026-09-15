import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CHROME_ACTIONS_VISIBLE_TRAILING,
  CHROME_ACTION_VARIANT_DEFAULT,
  shellui,
  type ChromeActionPayloadItem,
  type ChromeActionVariant,
  type ChromeActionsPayload,
  type LayoutChrome,
} from '@shellui/sdk';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { cn } from '../../lib/utils';
import { useViewport } from '../../hooks/use-viewport';
import { useSettings } from '../settings/hooks/useSettings';
import {
  FLOATING_CHROME_MARGIN,
  floatingTabBarBottomPadCss,
  floatingTabBarHeight,
} from '../layouts/floating/computeFloatingInsets';
import {
  getPublishedLayoutChrome,
  subscribeLayoutChrome,
} from '../layouts/floating/layoutChromeStore';
import { useChromeActionsSnapshot } from './ChromeActionsProvider';
import { SHELL_DEVELOP_CHROME_ACTIONS_FRAME, type FrameChromeActions } from './chromeActionsStore';
import {
  CHROME_ACTIONS_FAB_SIZE,
  CHROME_ACTIONS_TOP_BAR_HEIGHT,
  CHROME_ACTIONS_TOP_SCRIM_FADE,
  actionChromeFlags,
  chromeActionsFabEdgeMargin,
  chromeActionsFabSize,
  chromeActionsTopOffsetCss,
} from './computeActionInsets';
import {
  ChevronLeftIcon,
  ChromeActionGlyph,
  MoreHorizontalIcon,
  PlusIcon,
} from './ChromeActionIcons';

type FrameSurface = 'main' | 'overlay' | 'develop' | 'window';

/** Fade duration for chrome actions appear / clear (keep in sync with transition classes). */
const CHROME_ACTIONS_FADE_MS = 200;
/** Title swap: soft overlapping crossfade (opacity only). */
const CHROME_ACTIONS_TITLE_MS = 520;
/** Trailing row crossfade (old overlay → remove → new). */
const CHROME_ACTIONS_TRAILING_MS = 220;
/**
 * Back button slot open/close — width + glyph motion so the title translates
 * with the same curve (keep in sync with BackLeadingSlot / title shift).
 */
const CHROME_ACTIONS_BACK_SLOT_MS = 340;
/** Easing shared by back slot + title shift (snappy settle, soft land). */
const CHROME_ACTIONS_BACK_SLOT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Overlay back control: size-8 + mr-2. */
const CHROME_ACTIONS_BACK_SLOT_OPEN = 40;
/** Title-bar back control: size-7 + mr-1. */
const CHROME_ACTIONS_BACK_SLOT_OPEN_TITLEBAR = 32;
/** Collapsed leading spacer when no back control. */
const CHROME_ACTIONS_BACK_SLOT_CLOSED = 8;

/**
 * Floating phone/tablet hide-on-scroll: mirror nav chromeVisible for main-frame
 * action buttons. Desktop / other layouts / overlays stay visible.
 */
function scrollHideApplies(chrome: LayoutChrome | null, surface: FrameSurface): boolean {
  if (surface !== 'main') return false;
  if (!chrome || chrome.layout !== 'floating') return false;
  return chrome.viewport === 'mobile' || chrome.viewport === 'tablet';
}

function usePublishedLayoutChrome(): LayoutChrome | null {
  return useSyncExternalStore(subscribeLayoutChrome, getPublishedLayoutChrome, () => null);
}

type PresenceItem = {
  actions: FrameChromeActions;
  /** False while entering (pre-paint) or exiting (fade-out). */
  visible: boolean;
};

type TrailingItem = ChromeActionPayloadItem;

function resolveActionVariant(
  itemVariant: ChromeActionVariant | undefined,
  setVariant: ChromeActionVariant | undefined,
): ChromeActionVariant {
  return itemVariant ?? setVariant ?? CHROME_ACTION_VARIANT_DEFAULT;
}

/** Shared sizing for back / trailing chrome action controls (flat — no elevation). */
const chromeActionControlClass = 'shadow-none h-8 rounded-md text-xs';
const chromeActionIconControlClass = 'shadow-none size-8 rounded-md text-xs';
/** Windows title-bar: flush ghost controls that match maximize/close. */
const chromeActionTitlebarClass =
  'shadow-none border-0 bg-transparent text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground';
const chromeActionTitlebarDestructiveClass =
  'shadow-none border-0 bg-transparent text-destructive hover:bg-destructive/20 hover:text-destructive';

function resolveTitlebarButtonClass(variant: ChromeActionVariant): string {
  return variant === 'destructive'
    ? chromeActionTitlebarDestructiveClass
    : chromeActionTitlebarClass;
}

/** Icon-only chrome controls — show the action label on hover. */
function ChromeActionTooltip({
  label,
  side = 'bottom',
  children,
}: {
  label?: string | null;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}) {
  const text = label?.trim();
  if (!text) return <>{children}</>;
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align="center"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

type TrailingSnapshot = {
  /** Membership key (visible ids + more). Same key → in-place refresh, no crossfade. */
  key: string;
  visible: TrailingItem[];
  moreItems: TrailingItem[] | null;
};

const chromeActionsFadeClass =
  'transition-opacity duration-200 ease-out motion-reduce:transition-none';

function idsKey(ids: string[]): string {
  return ids.join('\0');
}

function buildTrailingSnapshot(trailing: TrailingItem[], narrow: boolean): TrailingSnapshot {
  const maxVisible = narrow ? 0 : CHROME_ACTIONS_VISIBLE_TRAILING;
  const visible = trailing.slice(0, maxVisible);
  const overflow = trailing.slice(maxVisible);
  const showMore = overflow.length > 0 || (narrow && trailing.length > 0);
  const moreItems = showMore ? (narrow ? trailing : overflow) : null;
  return {
    key: idsKey([...visible.map((i) => i.id), moreItems ? '__more__' : '']),
    visible,
    moreItems,
  };
}

/**
 * Keeps cleared frames mounted through the fade-out, and starts new frames
 * at opacity 0 so the first paint can transition in.
 */
function useChromeActionsPresence(live: FrameChromeActions[]): PresenceItem[] {
  const key = idsKey(live.map((a) => a.frameUuid));
  const liveRef = useRef(live);
  liveRef.current = live;

  const [items, setItems] = useState<PresenceItem[]>(() =>
    live.map((actions) => ({ actions, visible: true })),
  );

  useEffect(() => {
    const liveNow = liveRef.current;
    setItems((prev) => {
      const prevById = new Map(prev.map((p) => [p.actions.frameUuid, p]));
      const next: PresenceItem[] = [];

      for (const actions of liveNow) {
        const existing = prevById.get(actions.frameUuid);
        if (existing) {
          next.push({ actions, visible: true });
          prevById.delete(actions.frameUuid);
        } else {
          next.push({ actions, visible: false });
        }
      }
      for (const leftover of prevById.values()) {
        next.push({ actions: leftover.actions, visible: false });
      }

      if (
        prev.length === next.length &&
        prev.every(
          (p, i) =>
            p.actions.frameUuid === next[i].actions.frameUuid && p.visible === next[i].visible,
        )
      ) {
        let changed = false;
        const refreshed = prev.map((p, i) => {
          if (p.actions === next[i].actions) return p;
          changed = true;
          return { ...p, actions: next[i].actions };
        });
        return changed ? refreshed : prev;
      }
      return next;
    });
  }, [key]);

  useEffect(() => {
    const entering = items.some(
      (i) => !i.visible && liveRef.current.some((l) => l.frameUuid === i.actions.frameUuid),
    );
    if (!entering) return;
    const id = requestAnimationFrame(() => {
      setItems((prev) => {
        let changed = false;
        const next = prev.map((i) => {
          if (!i.visible && liveRef.current.some((l) => l.frameUuid === i.actions.frameUuid)) {
            changed = true;
            return { ...i, visible: true };
          }
          return i;
        });
        return changed ? next : prev;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [items]);

  useEffect(() => {
    const exitingIds = items
      .filter(
        (i) => !i.visible && !liveRef.current.some((l) => l.frameUuid === i.actions.frameUuid),
      )
      .map((i) => i.actions.frameUuid);
    if (exitingIds.length === 0) return;
    const exiting = new Set(exitingIds);
    const t = window.setTimeout(() => {
      setItems((prev) => {
        const next = prev.filter(
          (i) =>
            !exiting.has(i.actions.frameUuid) ||
            liveRef.current.some((l) => l.frameUuid === i.actions.frameUuid),
        );
        return next.length === prev.length ? prev : next;
      });
    }, CHROME_ACTIONS_FADE_MS);
    return () => window.clearTimeout(t);
  }, [items]);

  return items.map((entry) => {
    const fresh = live.find((l) => l.frameUuid === entry.actions.frameUuid);
    return fresh && fresh !== entry.actions ? { ...entry, actions: fresh } : entry;
  });
}

/** Single optional control (FAB) with enter + exit fade. */
function useOptionalPresence<T extends { id: string }>(
  live: T | null | undefined,
): { item: T | null; visible: boolean } {
  const liveId = live?.id ?? null;
  const liveRef = useRef(live);
  liveRef.current = live;

  const [held, setHeld] = useState<T | null>(live ?? null);
  const [visible, setVisible] = useState(Boolean(live));

  useEffect(() => {
    if (liveId) {
      const current = liveRef.current;
      if (current) setHeld(current);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => {
      if (!liveRef.current) setHeld(null);
    }, CHROME_ACTIONS_FADE_MS);
    return () => window.clearTimeout(t);
  }, [liveId]);

  // Prefer live payload while present; keep `held` only for the exit fade.
  return { item: live ?? held, visible };
}

function FadePresence({
  visible,
  scrollHidden = false,
  className,
  style,
  children,
}: {
  visible: boolean;
  /** Floating hide-on-scroll: slide away while presence stays mounted. */
  scrollHidden?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      data-visible={visible ? 'true' : 'false'}
      data-scroll-hidden={scrollHidden ? 'true' : 'false'}
      data-shellui-chrome-actions-fab-slot=""
      className={cn(
        // Opacity / translate transitions owned by index.css (match tab-bar hide).
        visible ? null : 'pointer-events-none',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * Soft title crossfade: old and new overlap and ease opacity only (no slide /
 * stagger). Layers stay absolute so trailing actions never reflow.
 * Horizontal motion comes from `BackLeadingSlot` width — the title rides flex layout.
 */
function ChromeActionTitle({ title }: { title?: string }) {
  const titleRef = useRef(title ?? '');
  const keyRef = useRef(0);
  const [outgoing, setOutgoing] = useState<{ text: string; leaving: boolean } | null>(null);
  const [current, setCurrent] = useState<{ text: string; key: number; shown: boolean }>({
    text: title ?? '',
    key: 0,
    shown: true,
  });

  useEffect(() => {
    const prev = titleRef.current;
    const next = title ?? '';
    if (prev === next) return;
    titleRef.current = next;

    if (!prev) {
      keyRef.current += 1;
      setOutgoing(null);
      setCurrent({ text: next, key: keyRef.current, shown: true });
      return;
    }

    keyRef.current += 1;
    const nextKey = keyRef.current;

    setOutgoing({ text: prev, leaving: false });
    setCurrent({ text: next, key: nextKey, shown: false });

    // Paint both layers at rest, then crossfade on the next frame.
    const swapRaf = requestAnimationFrame(() => {
      setOutgoing((o) => (o ? { ...o, leaving: true } : null));
      setCurrent((c) => (c.key === nextKey ? { ...c, shown: true } : c));
    });

    const clearOut = window.setTimeout(() => setOutgoing(null), CHROME_ACTIONS_TITLE_MS);

    return () => {
      cancelAnimationFrame(swapRaf);
      window.clearTimeout(clearOut);
    };
  }, [title]);

  if (!current.text && !outgoing) {
    return <span className="min-w-0 flex-1" />;
  }

  const fadeStyle = (): CSSProperties => ({
    transitionProperty: 'opacity',
    transitionDuration: `${CHROME_ACTIONS_TITLE_MS}ms`,
    transitionTimingFunction: 'ease-in-out',
  });

  const layerClass =
    'absolute inset-0 truncate text-sm font-semibold leading-5 text-foreground motion-reduce:transition-none';

  return (
    <span
      className="relative isolate min-w-0 flex-1 overflow-hidden px-1"
      style={{ height: '1.25rem', fontFamily: 'var(--heading-font-family, inherit)' }}
    >
      {outgoing ? (
        <span
          aria-hidden
          className={cn(
            layerClass,
            'pointer-events-none z-[1]',
            outgoing.leaving ? 'opacity-0' : 'opacity-100',
          )}
          style={fadeStyle()}
        >
          {outgoing.text}
        </span>
      ) : null}
      {current.text ? (
        <span
          key={current.key}
          className={cn(layerClass, 'z-[2]', current.shown ? 'opacity-100' : 'opacity-0')}
          style={fadeStyle()}
        >
          {current.text}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Leading back control: expands/collapses width so the title translates with it,
 * while the button fades + eases in from the left.
 */
function BackLeadingSlot({
  back,
  titlebar,
  setVariant,
  frameUuid,
  interactive,
}: {
  back?: ChromeActionPayloadItem | null;
  titlebar: boolean;
  setVariant?: ChromeActionVariant;
  frameUuid: string;
  interactive: boolean;
}) {
  const backId = back?.id ?? null;
  const [displayed, setDisplayed] = useState<ChromeActionPayloadItem | null>(back ?? null);
  const [open, setOpen] = useState(Boolean(back));

  useEffect(() => {
    if (back) {
      setDisplayed(back);
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    const t = window.setTimeout(() => setDisplayed(null), CHROME_ACTIONS_BACK_SLOT_MS);
    return () => window.clearTimeout(t);
  }, [backId]);

  // Refresh label/icon/disabled while the same back id stays mounted.
  useEffect(() => {
    if (back && open) setDisplayed(back);
  }, [back, open]);

  const openWidth = titlebar
    ? CHROME_ACTIONS_BACK_SLOT_OPEN_TITLEBAR
    : CHROME_ACTIONS_BACK_SLOT_OPEN;
  const width = open ? openWidth : CHROME_ACTIONS_BACK_SLOT_CLOSED;
  const item = displayed;

  return (
    <div
      data-shellui-chrome-actions-back-slot=""
      data-open={open ? 'true' : 'false'}
      className="relative shrink-0 overflow-hidden motion-reduce:transition-none"
      style={{
        width,
        transitionProperty: 'width',
        transitionDuration: `${CHROME_ACTIONS_BACK_SLOT_MS}ms`,
        transitionTimingFunction: CHROME_ACTIONS_BACK_SLOT_EASE,
      }}
    >
      {item ? (
        <div
          className={cn(
            'origin-left motion-reduce:transition-none',
            open ? 'translate-x-0 scale-100 opacity-100' : '-translate-x-2 scale-[0.92] opacity-0',
          )}
          style={{
            transitionProperty: 'opacity, transform',
            transitionDuration: `${CHROME_ACTIONS_BACK_SLOT_MS}ms`,
            transitionTimingFunction: CHROME_ACTIONS_BACK_SLOT_EASE,
          }}
        >
          <ChromeActionTooltip label={item.label || 'Back'}>
            <Button
              type="button"
              variant={titlebar ? 'ghost' : resolveActionVariant(item.variant, setVariant)}
              size="icon"
              disabled={Boolean(item.disabled)}
              className={cn(
                'shrink-0',
                titlebar
                  ? cn(
                      'mr-1 size-7',
                      resolveTitlebarButtonClass(resolveActionVariant(item.variant, setVariant)),
                    )
                  : cn('mr-2', chromeActionIconControlClass),
              )}
              aria-label={item.label || 'Back'}
              aria-hidden={!open}
              tabIndex={interactive && open ? undefined : -1}
              onClick={(e) => {
                e.stopPropagation();
                if (!open || item.disabled) return;
                fireAction(frameUuid, item.id);
              }}
            >
              {item.icon && item.icon !== 'back' ? (
                <ChromeActionGlyph
                  icon={item.icon}
                  label={item.label}
                  animate={item.animate}
                />
              ) : (
                <ChevronLeftIcon
                  className={item.animate === 'icon-rotate' ? 'animate-spin' : undefined}
                  {...(item.animate === 'icon-rotate'
                    ? { 'data-shellui-chrome-action-animate': 'icon-rotate' }
                    : {})}
                />
              )}
            </Button>
          </ChromeActionTooltip>
        </div>
      ) : (
        <span
          aria-hidden
          className="block size-2"
        />
      )}
    </div>
  );
}

/** Horizontal pad inside the action row (layout insets applied on the outer shell). */
function actionRowInlinePad(useLayoutInsets: boolean): CSSProperties {
  if (useLayoutInsets) {
    // Leading chip clearance is folded into the overlay `left` so it shares the
    // same CSS-var transition as `--shellui-inset-left` (no competing padding jump).
    return {
      paddingLeft: FLOATING_CHROME_MARGIN,
      paddingRight: FLOATING_CHROME_MARGIN,
    };
  }
  return {
    paddingLeft: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-left, 0px))`,
    paddingRight: `calc(${FLOATING_CHROME_MARGIN}px + var(--shellui-safe-area-right, 0px))`,
  };
}

function fireAction(frameUuid: string, id: string): void {
  // Develop buttons run in the shell window — trigger callbacks locally.
  if (frameUuid === SHELL_DEVELOP_CHROME_ACTIONS_FRAME) {
    shellui.callbackRegistry.triggerAction(id);
    return;
  }
  shellui.sendMessage({
    type: 'SHELLUI_ACTION',
    payload: { id },
    to: [frameUuid],
  });
}

function resolveFrameSurface(frameUuid: string): {
  rect: DOMRect | null;
  surface: FrameSurface;
  /** Overlay frames portal into the ContentView root (inside modal/drawer). */
  portalParent: HTMLElement | null;
  /** Match inset / rounded content frames so fixed chrome is clipped to their corners. */
  borderRadius: string;
} {
  if (frameUuid === SHELL_DEVELOP_CHROME_ACTIONS_FRAME) {
    return {
      rect: new DOMRect(0, 0, window.innerWidth, window.innerHeight),
      surface: 'develop',
      portalParent: null,
      borderRadius: '',
    };
  }
  for (const [uuid, iframe] of shellui.frameRegistry.getAllIframes()) {
    if (uuid === frameUuid && iframe.isConnected) {
      const isOverlay = iframe.getAttribute('data-shellui-frame') === 'overlay';
      // Portal into the window content root so FAB tracks drag/resize with the card.
      const inWindows = Boolean(iframe.closest('[data-shellui-windows-layout]'));
      const surface: FrameSurface = isOverlay ? 'overlay' : inWindows ? 'window' : 'main';
      return {
        rect: iframe.getBoundingClientRect(),
        surface,
        portalParent: isOverlay || inWindows ? iframe.parentElement : null,
        borderRadius: surface === 'main' ? resolveFrameClipRadius(iframe) : '',
      };
    }
  }
  return { rect: null, surface: 'main', portalParent: null, borderRadius: '' };
}

/**
 * Walk up from the content iframe to the nearest ancestor that both rounds and
 * clips (sidebar-inset / app-bar-inset cards). Fixed action chrome sits above
 * the iframe in the shell window, so it must reuse that radius to avoid square
 * corners poking past the rounded frame.
 */
function resolveFrameClipRadius(iframe: HTMLElement): string {
  let el: HTMLElement | null = iframe.parentElement;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const radii = [
      parseFloat(cs.borderTopLeftRadius),
      parseFloat(cs.borderTopRightRadius),
      parseFloat(cs.borderBottomRightRadius),
      parseFloat(cs.borderBottomLeftRadius),
    ];
    const hasRadius = radii.some((n) => Number.isFinite(n) && n > 0);
    const clips =
      cs.overflow === 'hidden' ||
      cs.overflow === 'auto' ||
      cs.overflow === 'clip' ||
      cs.overflowX === 'hidden' ||
      cs.overflowY === 'hidden';
    if (hasRadius && clips) {
      return cs.borderRadius;
    }
    el = el.parentElement;
  }
  return '';
}

function ActionButton({
  item,
  frameUuid,
  compact,
  setVariant,
  className,
  disabled,
  titlebar = false,
}: {
  item: TrailingItem;
  frameUuid: string;
  compact?: boolean;
  setVariant?: ChromeActionVariant;
  className?: string;
  disabled?: boolean;
  /** Windows title-bar: ghost, no fill/border. */
  titlebar?: boolean;
}) {
  const iconOnly = Boolean(item.icon) && (!item.label || compact);
  const resolved = resolveActionVariant(item.variant, setVariant);
  const variant = titlebar ? 'ghost' : resolved;
  const isDisabled = Boolean(disabled || item.disabled);
  const tip = item.label || item.icon || item.id;
  const button = (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? 'icon' : 'sm'}
      disabled={isDisabled}
      data-shellui-chrome-actions-hit=""
      className={cn(
        titlebar
          ? cn('h-7 rounded-md text-xs', resolveTitlebarButtonClass(resolved))
          : chromeActionControlClass,
        iconOnly ? (titlebar ? 'size-7 px-0' : 'size-8 px-0') : 'px-3',
        compact && iconOnly && !titlebar && 'size-7',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (isDisabled) return;
        fireAction(frameUuid, item.id);
      }}
      aria-label={tip}
    >
      {item.icon ? (
        <ChromeActionGlyph
          icon={item.icon}
          label={item.label}
          animate={item.animate}
        />
      ) : null}
      {item.label && !iconOnly ? <span className="max-w-[7rem] truncate">{item.label}</span> : null}
      {item.label && compact && !item.icon ? (
        <span className="max-w-[5rem] truncate">{item.label}</span>
      ) : null}
    </Button>
  );

  // Only tip when the label isn’t already visible on the control.
  if (!iconOnly) return button;
  return <ChromeActionTooltip label={tip}>{button}</ChromeActionTooltip>;
}

function TrailingActionsRow({
  snapshot,
  frameUuid,
  compact,
  setVariant,
  iconClassName,
  disabled,
  titlebar = false,
}: {
  snapshot: TrailingSnapshot;
  frameUuid: string;
  compact: boolean;
  setVariant?: ChromeActionVariant;
  iconClassName: string;
  disabled: boolean;
  titlebar?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {snapshot.visible.map((item) => (
        <ActionButton
          key={item.id}
          item={item}
          frameUuid={frameUuid}
          compact={compact}
          setVariant={setVariant}
          disabled={disabled}
          titlebar={titlebar}
        />
      ))}
      {snapshot.moreItems ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={titlebar ? 'ghost' : resolveActionVariant(undefined, setVariant)}
              size="icon"
              disabled={disabled}
              className={iconClassName}
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            {snapshot.moreItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                disabled={disabled || Boolean(item.disabled)}
                onSelect={() => {
                  if (disabled || item.disabled) return;
                  fireAction(frameUuid, item.id);
                }}
              >
                <ChromeActionGlyph
                  icon={item.icon}
                  label={item.label}
                  animate={item.animate}
                />
                <span className="truncate">{item.label || item.id}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/**
 * Crossfades the whole trailing cluster when membership changes:
 * new layout takes the layout slot, old overlays on top and fades out, then old is removed.
 * Buttons stay disabled for the duration so clicks can't land mid-transition.
 */
function TrailingActionsCrossfade({
  trailing,
  narrow,
  frameUuid,
  compact,
  isOverlay,
  setVariant,
}: {
  trailing: TrailingItem[];
  narrow: boolean;
  frameUuid: string;
  compact: boolean;
  isOverlay: boolean;
  setVariant?: ChromeActionVariant;
}) {
  const live = buildTrailingSnapshot(trailing, narrow);
  const liveKey = live.key;
  const contentSig = trailing
    .map(
      (t) =>
        `${t.id}:${t.label ?? ''}:${t.icon ?? ''}:${t.variant ?? ''}:${t.disabled ? 1 : 0}:${t.animate ?? ''}`,
    )
    .join('|');

  const [current, setCurrent] = useState(live);
  const [outgoing, setOutgoing] = useState<{
    snapshot: TrailingSnapshot;
    leaving: boolean;
  } | null>(null);
  const [incomingShown, setIncomingShown] = useState(true);
  const currentRef = useRef(current);
  currentRef.current = current;
  const trailingRef = useRef(trailing);
  trailingRef.current = trailing;
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;

  // Same membership: refresh labels/icons in place (no crossfade).
  useEffect(() => {
    const next = buildTrailingSnapshot(trailingRef.current, narrowRef.current);
    if (next.key === currentRef.current.key) {
      setCurrent(next);
    }
  }, [contentSig, narrow]);

  // Membership changed: overlay old row, swap layout to new, fade old out.
  useEffect(() => {
    const next = buildTrailingSnapshot(trailingRef.current, narrowRef.current);
    if (next.key === currentRef.current.key) return;

    const previous = currentRef.current;
    setOutgoing({ snapshot: previous, leaving: false });
    setCurrent(next);
    setIncomingShown(false);

    const leaveRaf = requestAnimationFrame(() => {
      setOutgoing((o) => (o ? { ...o, leaving: true } : null));
    });
    const showIn = window.setTimeout(() => setIncomingShown(true), 40);
    const clearOut = window.setTimeout(() => {
      setOutgoing(null);
      setIncomingShown(true);
    }, CHROME_ACTIONS_TRAILING_MS);

    return () => {
      cancelAnimationFrame(leaveRaf);
      window.clearTimeout(showIn);
      window.clearTimeout(clearOut);
    };
  }, [liveKey, narrow]);

  const busy = outgoing !== null || !incomingShown;
  const titlebar = !isOverlay;
  const iconClassName = cn(
    titlebar
      ? cn('size-7 rounded-md text-xs', chromeActionTitlebarClass)
      : chromeActionIconControlClass,
  );
  const empty = current.visible.length === 0 && !current.moreItems && !outgoing;
  if (empty) return null;

  return (
    <div className="relative isolate flex shrink-0 items-center">
      <div
        className={cn(
          chromeActionsFadeClass,
          incomingShown ? 'opacity-100' : 'opacity-0',
          busy && 'pointer-events-none',
        )}
        style={{ transitionDuration: `${CHROME_ACTIONS_TRAILING_MS}ms` }}
      >
        <TrailingActionsRow
          snapshot={current}
          frameUuid={frameUuid}
          compact={compact}
          setVariant={setVariant}
          iconClassName={iconClassName}
          disabled={busy}
          titlebar={titlebar}
        />
      </div>
      {outgoing ? (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 z-[1] flex items-center',
            chromeActionsFadeClass,
            outgoing.leaving ? 'opacity-0' : 'opacity-100',
          )}
          style={{ transitionDuration: `${CHROME_ACTIONS_TRAILING_MS}ms` }}
        >
          <TrailingActionsRow
            snapshot={outgoing.snapshot}
            frameUuid={frameUuid}
            compact={compact}
            setVariant={setVariant}
            iconClassName={iconClassName}
            disabled
            titlebar={titlebar}
          />
        </div>
      ) : null}
    </div>
  );
}

function TopActionBar({
  actions,
  placement,
  visible = true,
  /** When true, honor host `--shellui-inset-left/right` (main floating content). */
  useLayoutInsets = false,
  /** Floating hide-on-scroll — slide/fade with the tab bar (main frame only). */
  scrollHidden = false,
}: {
  actions: FrameChromeActions;
  placement: 'overlay' | 'titlebar';
  visible?: boolean;
  useLayoutInsets?: boolean;
  scrollHidden?: boolean;
}) {
  const viewport = useViewport();
  const narrow = viewport === 'mobile' || viewport === 'tablet';
  const trailing = actions.trailing ?? [];
  const topOffset = chromeActionsTopOffsetCss(viewport);

  const flags = actionChromeFlags(actions);
  if (!flags.hasTop) return null;

  const back = actions.back;
  const isOverlay = placement === 'overlay';
  const titlebar = placement === 'titlebar';
  const inlinePad = isOverlay ? actionRowInlinePad(useLayoutInsets) : undefined;
  const setVariant = actions.variant;
  const interactive = visible && !scrollHidden;

  return (
    <TooltipProvider delayDuration={250}>
      <div
        data-shellui-chrome-actions-top={placement}
        data-visible={visible ? 'true' : 'false'}
        data-scroll-hidden={scrollHidden ? 'true' : 'false'}
        className={cn(
          'pointer-events-none',
          // Overlay: opacity/translate owned by index.css (scroll hide + presence).
          !isOverlay && chromeActionsFadeClass,
          !isOverlay && (visible ? 'opacity-100' : 'opacity-0'),
          isOverlay && 'absolute inset-x-0 top-0 z-[46]',
          titlebar && 'relative min-w-0 flex-1',
        )}
        style={
          isOverlay && useLayoutInsets
            ? {
                // One animated edge (inset + collapsed-chip clearance) so actions
                // track the floating sidebar / layout resize instead of fighting it.
                left: `calc(var(--shellui-inset-left, 0px) + var(--shellui-chrome-actions-leading-extra, 0px))`,
                right: 'var(--shellui-inset-right, 0px)',
              }
            : undefined
        }
      >
        {isOverlay ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-background/50 from-90% to-transparent"
            style={{
              // Light tint through the action row, then fade — no blur (animates poorly).
              // Top offset is max(margin, safe-area) so we don’t stack both.
              height: `calc(${topOffset} + ${CHROME_ACTIONS_TOP_BAR_HEIGHT}px + ${CHROME_ACTIONS_TOP_SCRIM_FADE}px)`,
            }}
          />
        ) : null}

        <div
          data-shellui-chrome-actions-hit=""
          className={cn(
            'pointer-events-auto relative flex items-center gap-2',
            titlebar && 'min-w-0 flex-1 gap-1',
            !interactive && 'pointer-events-none',
          )}
          style={
            isOverlay
              ? {
                  top: topOffset,
                  height: CHROME_ACTIONS_TOP_BAR_HEIGHT,
                  ...inlinePad,
                }
              : undefined
          }
        >
          <BackLeadingSlot
            back={back}
            titlebar={titlebar}
            setVariant={setVariant}
            frameUuid={actions.frameUuid}
            interactive={interactive}
          />

          <ChromeActionTitle title={actions.title} />

          <TrailingActionsCrossfade
            trailing={trailing}
            narrow={narrow}
            frameUuid={actions.frameUuid}
            compact={titlebar}
            isOverlay={isOverlay}
            setVariant={setVariant}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

function PrimaryFab({
  actions,
  bottomOffset,
  visible = true,
  useLayoutInsets = false,
  scrollHidden = false,
  sizePx = CHROME_ACTIONS_FAB_SIZE,
  edgeMargin = FLOATING_CHROME_MARGIN,
  /** Phone/tablet dock: binary pill. Desktop: theme `--radius` (0 → square). */
  shape = 'theme',
}: {
  actions: FrameChromeActions;
  /** Pixel number or CSS length (e.g. calc with safe-area). */
  bottomOffset: number | string;
  visible?: boolean;
  useLayoutInsets?: boolean;
  scrollHidden?: boolean;
  /** FAB diameter in px. */
  sizePx?: number;
  /** Outer inset from the frame / screen edge. */
  edgeMargin?: number;
  shape?: 'pill' | 'theme';
}) {
  const primary = actions.primary ?? null;
  const { item, visible: itemVisible } = useOptionalPresence(primary);
  if (!item) return null;

  const right = useLayoutInsets
    ? `calc(var(--shellui-inset-right, 0px) + ${edgeMargin}px)`
    : `calc(${edgeMargin}px + var(--shellui-safe-area-right, 0px))`;

  const ariaLabel = item.label || item.icon || 'Primary action';
  const shown = visible && itemVisible && !scrollHidden;

  return (
    <FadePresence
      visible={visible && itemVisible}
      scrollHidden={scrollHidden}
      className="pointer-events-auto absolute z-[46]"
      style={{
        right,
        bottom: bottomOffset,
      }}
    >
      <Button
        type="button"
        variant="default"
        size="icon"
        disabled={Boolean(item.disabled)}
        data-shellui-chrome-actions-fab=""
        data-shellui-chrome-actions-hit=""
        data-shellui-floating-fab={shape === 'pill' ? 'true' : undefined}
        className={cn('shadow-sm', shape === 'theme' && 'rounded-md')}
        style={{ width: sizePx, height: sizePx }}
        aria-label={ariaLabel}
        tabIndex={shown ? undefined : -1}
        onClick={(e) => {
          e.stopPropagation();
          if (item.disabled) return;
          fireAction(actions.frameUuid, item.id);
        }}
      >
        {item.icon ? (
          <ChromeActionGlyph
            icon={item.icon}
            label={item.label}
            animate={item.animate}
          />
        ) : item.label ? (
          <span className="px-1 text-sm font-semibold">{item.label}</span>
        ) : (
          <PlusIcon
            className={item.animate === 'icon-rotate' ? 'animate-spin' : undefined}
            {...(item.animate === 'icon-rotate'
              ? { 'data-shellui-chrome-action-animate': 'icon-rotate' }
              : {})}
          />
        )}
      </Button>
    </FadePresence>
  );
}

function FrameActionsOverlay({
  actions,
  showTop,
  fabBottomOffset,
  visible,
  scrollHidden = false,
  fabSizePx = CHROME_ACTIONS_FAB_SIZE,
  fabEdgeMargin = FLOATING_CHROME_MARGIN,
  fabShape = 'theme',
}: {
  actions: FrameChromeActions;
  showTop: boolean;
  fabBottomOffset: number | string;
  visible: boolean;
  /** Floating phone/tablet: hide with nav on scroll. */
  scrollHidden?: boolean;
  /** Main-frame FAB diameter. */
  fabSizePx?: number;
  /** Main-frame FAB edge inset. */
  fabEdgeMargin?: number;
  /** Main-frame FAB corner treatment. */
  fabShape?: 'pill' | 'theme';
}) {
  const [{ rect, surface, portalParent, borderRadius }, setFrame] = useState(() =>
    resolveFrameSurface(actions.frameUuid),
  );

  const refresh = useCallback(() => {
    setFrame(resolveFrameSurface(actions.frameUuid));
  }, [actions.frameUuid]);

  // Keep the fixed overlay locked to the iframe while layout animates (sidebar
  // collapse, inset transitions). Polling every 500ms lagged behind CSS motion.
  useEffect(() => {
    refresh();

    let raf = 0;
    let trackingUntil = 0;

    const read = () => {
      setFrame((prev) => {
        const next = resolveFrameSurface(actions.frameUuid);
        const a = prev.rect;
        const b = next.rect;
        if (
          a &&
          b &&
          a.top === b.top &&
          a.left === b.left &&
          a.width === b.width &&
          a.height === b.height &&
          prev.surface === next.surface &&
          prev.portalParent === next.portalParent &&
          prev.borderRadius === next.borderRadius
        ) {
          return prev;
        }
        return next;
      });
    };

    const tick = () => {
      raf = 0;
      read();
      if (performance.now() < trackingUntil) {
        raf = requestAnimationFrame(tick);
      }
    };

    const trackFor = (ms: number) => {
      trackingUntil = Math.max(trackingUntil, performance.now() + ms);
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onResize = () => trackFor(240);
    window.addEventListener('resize', onResize);

    const iframe = (() => {
      for (const [uuid, el] of shellui.frameRegistry.getAllIframes()) {
        if (uuid === actions.frameUuid && el.isConnected) return el;
      }
      return null;
    })();

    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => trackFor(240)) : null;
    if (iframe) {
      ro?.observe(iframe);
      if (iframe.parentElement) ro?.observe(iframe.parentElement);
    }

    // Floating sidebar / inset CSS vars transition — follow for the full duration.
    const onTransition = (event: TransitionEvent) => {
      const prop = event.propertyName;
      if (
        prop === 'transform' ||
        prop === 'width' ||
        prop === 'left' ||
        prop === 'padding-left' ||
        prop.startsWith('--shellui-inset') ||
        prop === '--shellui-chrome-actions-leading-extra'
      ) {
        trackFor(240);
      }
    };
    document.addEventListener('transitionrun', onTransition, true);
    document.addEventListener('transitionstart', onTransition, true);

    // Catch the sidebar toggle even before transition events fire.
    trackFor(240);

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('transitionrun', onTransition, true);
      document.removeEventListener('transitionstart', onTransition, true);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [actions.frameUuid, refresh]);

  const isOverlaySurface = surface === 'overlay';
  const isWindowSurface = surface === 'window';
  const useLayoutInsets = surface === 'main' || surface === 'develop';
  // Corner FAB inside portaled surfaces (modal/drawer/window content).
  const overlayFabOffset =
    isOverlaySurface || isWindowSurface ? FLOATING_CHROME_MARGIN : fabBottomOffset;
  const fabSize = isOverlaySurface || isWindowSurface ? CHROME_ACTIONS_FAB_SIZE : fabSizePx;
  const fabEdge = isOverlaySurface || isWindowSurface ? FLOATING_CHROME_MARGIN : fabEdgeMargin;
  const shape = isOverlaySurface || isWindowSurface ? 'theme' : fabShape;
  // Overlays / windows / develop never follow floating tab-bar hide-on-scroll.
  const hideWithNav = scrollHidden && surface === 'main';

  const chrome = (
    <>
      {showTop ? (
        <TopActionBar
          actions={actions}
          placement="overlay"
          visible={visible}
          scrollHidden={hideWithNav}
          useLayoutInsets={useLayoutInsets}
        />
      ) : null}
      <PrimaryFab
        actions={actions}
        bottomOffset={overlayFabOffset}
        visible={visible}
        scrollHidden={hideWithNav}
        useLayoutInsets={useLayoutInsets}
        sizePx={fabSize}
        edgeMargin={fabEdge}
        shape={shape}
      />
    </>
  );

  // Overlay / window iframes: portal into ContentView root so chrome stays inside
  // the host surface (modal stacking, window drag/resize).
  if (portalParent) {
    return createPortal(
      <div
        data-shellui-chrome-actions=""
        data-shellui-chrome-actions-frame={actions.frameUuid}
        data-shellui-chrome-actions-surface={surface}
        className="pointer-events-none absolute inset-0 z-10"
      >
        {chrome}
      </div>,
      portalParent,
    );
  }

  if (!rect || rect.width < 8 || rect.height < 8) return null;

  return (
    <div
      data-shellui-chrome-actions=""
      data-shellui-chrome-actions-frame={actions.frameUuid}
      data-shellui-chrome-actions-surface={surface}
      className="pointer-events-none fixed z-[46]"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        // Mirror inset card clipping — fixed chrome is outside the iframe's
        // overflow:hidden, so without this the corners stay square.
        ...(borderRadius ? { borderRadius, overflow: 'hidden' as const } : {}),
      }}
    >
      {chrome}
    </div>
  );
}

/**
 * Host chrome for SDK floating actions — top bar + bottom FAB, positioned
 * over each content iframe that has declared actions.
 */
export function ChromeActionsHost() {
  const live = useChromeActionsSnapshot();
  const presence = useChromeActionsPresence(live);
  const { settings } = useSettings();
  const viewport = useViewport();
  const windowsLayout = settings.layout === 'windows';
  const layoutChrome = usePublishedLayoutChrome();

  const floatingDock =
    settings.layout === 'floating' && (viewport === 'mobile' || viewport === 'tablet');
  // Floating dock: FAB diameter matches the bottom nav bar height (phone 56 / tablet 64).
  const fabSizePx = floatingDock ? floatingTabBarHeight(viewport) : chromeActionsFabSize(viewport);
  const fabEdgeMargin = chromeActionsFabEdgeMargin(viewport);
  // Pill only beside the phone/tablet dock; desktop uses theme radius (square when 0).
  const fabShape = floatingDock ? 'pill' : 'theme';

  const fabBottomOffset = useMemo(() => {
    if (floatingDock) {
      // Match FloatingBottomDock paddingBottom (includes safe-area CSS var).
      return floatingTabBarBottomPadCss(viewport);
    }
    return fabEdgeMargin;
  }, [floatingDock, viewport, fabEdgeMargin]);

  // Same hide-on-scroll signal as FloatingBottomDock (phone/tablet floating only).
  const scrollHidden = Boolean(
    layoutChrome && scrollHideApplies(layoutChrome, 'main') && layoutChrome.chromeVisible === false,
  );

  if (presence.length === 0) return null;

  return (
    <>
      {presence.map(({ actions, visible }) => (
        <FrameActionsOverlay
          key={actions.frameUuid}
          actions={actions}
          visible={visible}
          scrollHidden={scrollHidden}
          fabSizePx={fabSizePx}
          fabEdgeMargin={fabEdgeMargin}
          fabShape={fabShape}
          showTop={!windowsLayout || actions.frameUuid === SHELL_DEVELOP_CHROME_ACTIONS_FRAME}
          fabBottomOffset={windowsLayout ? FLOATING_CHROME_MARGIN : fabBottomOffset}
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
  const [displayed, setDisplayed] = useState<FrameChromeActions | null>(actions);
  const [barVisible, setBarVisible] = useState(
    Boolean(actions && actionChromeFlags(actions).hasTop),
  );

  useEffect(() => {
    if (actions && actionChromeFlags(actions).hasTop) {
      setDisplayed(actions.title ? actions : { ...actions, title: fallbackTitle });
      const id = requestAnimationFrame(() => setBarVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setBarVisible(false);
    const t = window.setTimeout(() => setDisplayed(null), CHROME_ACTIONS_FADE_MS);
    return () => window.clearTimeout(t);
  }, [actions, fallbackTitle]);

  if (displayed && actionChromeFlags(displayed).hasTop) {
    return (
      <TopActionBar
        actions={displayed}
        placement="titlebar"
        visible={barVisible}
      />
    );
  }
  if (fallbackTitle) {
    return (
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm font-medium',
          chromeActionsFadeClass,
          'opacity-100',
        )}
      >
        {fallbackTitle}
      </span>
    );
  }
  return <span className="min-w-0 flex-1" />;
}

export type { ChromeActionsPayload };
