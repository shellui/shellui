import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import type {
  NavigationItem,
  NavigationGroup,
  LocalizedString,
  ThemeAsset,
} from '../../config/types';
import {
  filterNavigationForAuthState,
  flattenNavigationItems,
  getActivePathPrefix,
  getNavPathPrefix,
  hasLoginNavigationItem,
  resolveLocalizedString as resolveNavLabel,
  splitNavigationByPosition,
} from '../utils';
import { useSettings } from '../../settings/hooks/useSettings';
import { ContentView } from '../../../components/ContentView';
import { cn } from '../../../lib/utils';
import { Z_INDEX } from '../../../lib/z-index';
import { LoginButton } from '../../auth/components/LoginButton';
import { useAuth } from '../../auth/hooks/useAuth';
import { ExternalLinkIcon, NavIcon } from '../sidebar/SidebarIcons';
import { getExternalFaviconUrl, isAppIcon } from '../sidebar/sidebarUtils';
import { AppBrandIcon } from '../branding/AppBrandIcon';

interface WindowsLayoutProps {
  title?: string;
  appIcon?: ThemeAsset;
  logo?: ThemeAsset;
  navigation: (NavigationItem | NavigationGroup)[];
}

type StartSection =
  | { type: 'group'; title: string | LocalizedString; items: NavigationItem[] }
  | { type: 'items'; items: NavigationItem[] };

const isNavigationGroup = (item: NavigationItem | NavigationGroup): item is NavigationGroup =>
  'title' in item && 'items' in item;

/** Keep navigation groups as labeled categories; consecutive loose items share one untitled section. */
function buildStartSections(start: (NavigationItem | NavigationGroup)[]): StartSection[] {
  const sections: StartSection[] = [];
  for (const entry of start) {
    if (isNavigationGroup(entry)) {
      const items = entry.items.filter((i) => !i.hidden);
      if (items.length > 0) {
        sections.push({ type: 'group', title: entry.title, items });
      }
      continue;
    }
    if (entry.hidden) continue;
    const last = sections[sections.length - 1];
    if (last?.type === 'items') {
      last.items.push(entry);
    } else {
      sections.push({ type: 'items', items: [entry] });
    }
  }
  return sections;
}

const genId = () => `win-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface WindowState {
  id: string;
  path: string;
  pathname: string;
  baseUrl: string;
  label: string;
  icon: string | null;
  bounds: { x: number; y: number; w: number; h: number };
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;
const TASKBAR_HEIGHT = 48;

function getMaximizedBounds(): WindowState['bounds'] {
  return {
    x: 0,
    y: 0,
    w: typeof window !== 'undefined' ? window.innerWidth : 800,
    h: typeof window !== 'undefined' ? window.innerHeight - TASKBAR_HEIGHT : 600,
  };
}

function buildFinalUrl(baseUrl: string, path: string, pathname: string): string {
  const pathPrefix = getNavPathPrefix({ path } as NavigationItem);
  const subPath = pathname.length > pathPrefix.length ? pathname.slice(pathPrefix.length + 1) : '';
  if (!subPath) return baseUrl;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${subPath}`;
}

/** Single draggable/resizable window */
function AppWindow({
  win,
  navItem,
  currentLanguage,
  isFocused,
  onFocus,
  onClose,
  onBoundsChange,
  maxZIndex,
  zIndex,
}: {
  win: WindowState;
  navItem: NavigationItem;
  currentLanguage: string;
  isFocused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onBoundsChange: (bounds: WindowState['bounds']) => void;
  maxZIndex: number;
  zIndex: number;
}) {
  const windowLabel = resolveNavLabel(navItem.label, currentLanguage);
  const [bounds, setBounds] = useState(win.bounds);
  const [isMaximized, setIsMaximized] = useState(false);
  const boundsBeforeMaximizeRef = useRef<WindowState['bounds']>(bounds);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startBounds: WindowState['bounds'];
    lastDx: number;
    lastDy: number;
  } | null>(null);
  const resizeRef = useRef<{
    edge: string;
    startX: number;
    startY: number;
    startBounds: WindowState['bounds'];
  } | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const pendingResizeBoundsRef = useRef<WindowState['bounds'] | null>(null);

  // Use a ref for onBoundsChange to avoid it in effect deps (prevents infinite render loop).
  // The parent creates a new callback reference on every render (inline arrow), so including
  // it in a dependency array would re-fire the effect every render, triggering a state update
  // in the parent, which re-renders, which re-fires the effect → React error #185.
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  useEffect(() => {
    onBoundsChangeRef.current(bounds);
  }, [bounds]);

  // When maximized, keep filling the viewport on window resize
  useEffect(() => {
    if (!isMaximized) return;
    const onResize = () => setBounds(getMaximizedBounds());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMaximized]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.lastDx = dx;
    d.lastDy = dy;
    const el = containerRef.current;
    if (el) {
      el.style.willChange = 'transform';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }, []);

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const el = containerRef.current;
      if (el) {
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp as (e: Event) => void);
        el.releasePointerCapture(e.pointerId);
      }
      if (dragRef.current) {
        const d = dragRef.current;
        if (el) {
          el.style.transform = '';
          el.style.willChange = '';
        }
        const finalBounds: WindowState['bounds'] = {
          ...d.startBounds,
          x: Math.max(0, d.startBounds.x + d.lastDx),
          y: Math.max(0, d.startBounds.y + d.lastDy),
        };
        setBounds(finalBounds);
        dragRef.current = null;
      }
    },
    [onPointerMove],
  );

  const handleTitlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0 || isMaximized) return;
      // Don't start drag when clicking a button (close, maximize) so their click handlers run
      if ((e.target as Element).closest('button')) return;
      e.preventDefault();
      onFocus();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startBounds: { ...bounds },
        lastDx: 0,
        lastDy: 0,
      };
      const el = containerRef.current;
      if (el) {
        el.setPointerCapture(e.pointerId);
        el.addEventListener('pointermove', onPointerMove, { passive: true });
        el.addEventListener('pointerup', onPointerUp as (e: Event) => void);
      }
    },
    [bounds, isMaximized, onFocus, onPointerMove, onPointerUp],
  );

  const handleMaximizeToggle = useCallback(() => {
    if (isMaximized) {
      setBounds(boundsBeforeMaximizeRef.current);
      setIsMaximized(false);
    } else {
      boundsBeforeMaximizeRef.current = { ...bounds };
      setBounds(getMaximizedBounds());
      setIsMaximized(true);
    }
  }, [isMaximized, bounds]);

  const onResizePointerMove = useCallback((e: PointerEvent) => {
    if (!resizeRef.current) return;
    const { edge, startX, startY, startBounds } = resizeRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const next: WindowState['bounds'] = { ...startBounds };
    if (edge.includes('e')) next.w = Math.max(MIN_WIDTH, startBounds.w + dx);
    if (edge.includes('w')) {
      const newW = Math.max(MIN_WIDTH, startBounds.w - dx);
      next.x = startBounds.x + startBounds.w - newW;
      next.w = newW;
    }
    if (edge.includes('s')) next.h = Math.max(MIN_HEIGHT, startBounds.h + dy);
    if (edge.includes('n')) {
      const newH = Math.max(MIN_HEIGHT, startBounds.h - dy);
      next.y = startBounds.y + startBounds.h - newH;
      next.h = newH;
    }
    pendingResizeBoundsRef.current = next;
    if (resizeRafRef.current === null) {
      resizeRafRef.current = requestAnimationFrame(() => {
        const pending = pendingResizeBoundsRef.current;
        resizeRafRef.current = null;
        pendingResizeBoundsRef.current = null;
        if (pending) setBounds(pending);
      });
    }
  }, []);

  const onResizePointerUp = useCallback(
    (e: PointerEvent) => {
      const el = containerRef.current;
      if (el) {
        el.removeEventListener('pointermove', onResizePointerMove as (e: Event) => void);
        el.removeEventListener('pointerup', onResizePointerUp as (e: Event) => void);
        el.releasePointerCapture(e.pointerId);
      }
      resizeRef.current = null;
    },
    [onResizePointerMove],
  );

  const handleResizePointerDown = useCallback(
    (e: ReactPointerEvent, edge: string) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      resizeRef.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startBounds: { ...bounds },
      };
      const el = containerRef.current;
      if (el) {
        el.setPointerCapture(e.pointerId);
        el.addEventListener('pointermove', onResizePointerMove as (e: Event) => void, {
          passive: true,
        });
        el.addEventListener('pointerup', onResizePointerUp as (e: Event) => void);
      }
    },
    [bounds, onFocus, onResizePointerMove, onResizePointerUp],
  );

  const finalUrl = useMemo(
    () => buildFinalUrl(win.baseUrl, win.path, win.pathname),
    [win.baseUrl, win.path, win.pathname],
  );

  const z = isFocused ? maxZIndex : zIndex;

  return (
    <div
      ref={containerRef}
      className="absolute flex flex-col rounded-lg border border-border bg-card shadow-lg overflow-hidden"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.w,
        height: bounds.h,
        zIndex: z,
      }}
      onClick={onFocus}
      onMouseDown={onFocus}
    >
      {/* Title bar: pointer capture so drag continues when cursor is over iframe or outside window */}
      <div
        className="flex items-center gap-2 pl-2 pr-1 py-1 bg-muted/80 border-b border-border cursor-move select-none shrink-0"
        onPointerDown={handleTitlePointerDown}
      >
        {win.icon && (
          <img
            src={win.icon}
            alt=""
            className={cn(
              'h-4 w-4 shrink-0 rounded-sm object-cover',
              isAppIcon(win.icon) && 'opacity-90 dark:opacity-100 dark:invert',
            )}
          />
        )}
        <span className="flex-1 text-sm font-medium truncate min-w-0">{windowLabel}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleMaximizeToggle();
          }}
          className="p-1 rounded cursor-pointer text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <RestoreIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded cursor-pointer text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Close"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0 relative bg-background">
        {/* When not focused, overlay captures clicks to bring window to front */}
        {!isFocused && (
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={onFocus}
            onMouseDown={(e) => {
              e.stopPropagation();
              onFocus();
            }}
            aria-hidden
          />
        )}
        <ContentView
          url={finalUrl}
          pathPrefix={win.path}
          ignoreMessages={true}
          navItem={navItem}
        />
      </div>
      {/* Resize handles (hidden when maximized) */}
      {!isMaximized &&
        (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const).map((edge) => (
          <div
            key={edge}
            className={cn(
              'absolute bg-transparent',
              edge.includes('n') && 'top-0 h-2 cursor-n-resize',
              edge.includes('s') && 'bottom-0 h-2 cursor-s-resize',
              edge.includes('e') && 'right-0 w-2 cursor-e-resize',
              edge.includes('w') && 'left-0 w-2 cursor-w-resize',
              edge === 'n' && 'left-2 right-2',
              edge === 's' && 'left-2 right-2',
              edge === 'e' && 'top-2 bottom-2',
              edge === 'w' && 'top-2 bottom-2',
              edge === 'ne' && 'top-0 right-0 w-2 h-2 cursor-ne-resize',
              edge === 'nw' && 'top-0 left-0 w-2 h-2 cursor-nw-resize',
              edge === 'se' && 'bottom-0 right-0 w-2 h-2 cursor-se-resize',
              edge === 'sw' && 'bottom-0 left-0 w-2 h-2 cursor-sw-resize',
            )}
            style={
              edge === 'n'
                ? { left: 8, right: 8 }
                : edge === 's'
                  ? { left: 8, right: 8 }
                  : edge === 'e'
                    ? { top: 8, bottom: 8 }
                    : edge === 'w'
                      ? { top: 8, bottom: 8 }
                      : undefined
            }
            onPointerDown={(e) => handleResizePointerDown(e, edge)}
          />
        ))}
    </div>
  );
}

function MaximizeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="10"
        height="10"
        rx="1"
      />
      <rect
        x="11"
        y="11"
        width="10"
        height="10"
        rx="1"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** Start menu icon (Windows-style) */
function StartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
    </svg>
  );
}

function getBrowserTimezone(): string {
  if (typeof window !== 'undefined' && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
}

export function WindowsLayout({ title, appIcon, logo: _logo, navigation }: WindowsLayoutProps) {
  const location = useLocation();
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const currentLanguage = i18n.language || 'en';
  const hasCustomLoginNav = useMemo(() => hasLoginNavigationItem(navigation), [navigation]);
  const authAwareNavigation = useMemo(
    () =>
      filterNavigationForAuthState(navigation, isAuthenticated, settings.developerFeatures.enabled),
    [navigation, isAuthenticated, settings.developerFeatures.enabled],
  );
  const timeZone = settings.region?.timezone ?? getBrowserTimezone();
  const { startSections, endNavItems, navigationItems } = useMemo(() => {
    const { start, end } = splitNavigationByPosition(authAwareNavigation);
    return {
      startSections: buildStartSections(start),
      endNavItems: end,
      navigationItems: flattenNavigationItems(authAwareNavigation),
    };
  }, [authAwareNavigation]);

  const [windows, setWindows] = useState<WindowState[]>([]);
  /** Id of the window that is on top (first plan). Clicking a window or its taskbar button sets this. */
  const [frontWindowId, setFrontWindowId] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const startPanelRef = useRef<HTMLDivElement>(null);
  const initialOpenFromUrlDoneRef = useRef(false);
  const openPaths = useMemo(() => new Set(windows.map((w) => w.path)), [windows]);

  // Update date/time every second for taskbar clock
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  /** Highest z-index: front window always gets this so it stays on top. */
  const maxZIndex = useMemo(
    () => Z_INDEX.WINDOWS_WINDOW_BASE + Math.max(windows.length, 1),
    [windows.length],
  );

  const openWindow = useCallback(
    (item: NavigationItem) => {
      const label =
        typeof item.label === 'string' ? item.label : resolveNavLabel(item.label, currentLanguage);
      const faviconUrl =
        item.openIn === 'external' && !item.icon ? getExternalFaviconUrl(item.url) : null;
      const icon = item.icon ?? faviconUrl ?? null;
      const id = genId();
      const bounds = {
        x: 60 + windows.length * 24,
        y: 60 + windows.length * 24,
        w: DEFAULT_WIDTH,
        h: DEFAULT_HEIGHT,
      };
      setWindows((prev) => [
        ...prev,
        {
          id,
          path: item.path,
          pathname: getNavPathPrefix(item),
          baseUrl: item.url,
          label,
          icon,
          bounds,
        },
      ]);
      setFrontWindowId(id);
      setStartMenuOpen(false);
    },
    [currentLanguage, windows.length],
  );

  // On first load only: open a window for the current URL if it matches a nav item (no reaction to later URL changes)
  useEffect(() => {
    if (initialOpenFromUrlDoneRef.current) return;
    initialOpenFromUrlDoneRef.current = true;
    const pathname = location.pathname;
    const windowableItems = navigationItems.filter(
      (i) => i.openIn !== 'modal' && i.openIn !== 'drawer' && i.openIn !== 'external',
    );
    const pathPrefix = getActivePathPrefix(pathname, windowableItems);
    if (!pathPrefix) return;
    const item = windowableItems.find((i) => getNavPathPrefix(i) === pathPrefix);
    if (item) openWindow(item);
  }, [location.pathname, navigationItems, openWindow]);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setFrontWindowId((current) => (current === id ? null : current));
  }, []);

  // When front window is closed or missing, bring first window to front
  useEffect(() => {
    if (windows.length === 0) {
      setFrontWindowId(null);
      return;
    }
    const frontStillExists = frontWindowId !== null && windows.some((w) => w.id === frontWindowId);
    if (!frontStillExists) {
      setFrontWindowId(windows[0].id);
    }
  }, [windows, frontWindowId]);

  /** Bring the window to front (first plan). Used when clicking the window or its taskbar button. */
  const focusWindow = useCallback((id: string) => {
    setFrontWindowId(id);
  }, []);

  const updateWindowBounds = useCallback((id: string, bounds: WindowState['bounds']) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, bounds } : w)));
  }, []);

  // Close start menu on click outside
  useEffect(() => {
    if (!startMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (startPanelRef.current && !startPanelRef.current.contains(e.target as Node)) {
        setStartMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [startMenuOpen]);

  const handleNavClick = useCallback(
    (item: NavigationItem) => {
      if (item.openIn === 'modal') {
        shellui.openModal(item.url);
        setStartMenuOpen(false);
        return;
      }
      if (item.openIn === 'drawer') {
        shellui.openDrawer({ url: item.url, position: item.drawerPosition });
        setStartMenuOpen(false);
        return;
      }
      if (item.openIn === 'external') {
        window.open(item.url, '_blank', 'noopener,noreferrer');
        setStartMenuOpen(false);
        return;
      }
      const existing = windows.find((w) => w.path === item.path);
      if (existing) {
        focusWindow(existing.id);
        setStartMenuOpen(false);
        return;
      }
      openWindow(item);
    },
    [openWindow, windows, focusWindow],
  );

  return (
    <>
      <div
        className="fixed inset-0 overflow-hidden bg-background"
        style={{ paddingBottom: TASKBAR_HEIGHT }}
      >
        {/* Organic primary wash behind windows — follows --primary with the active theme. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              'radial-gradient(ellipse 95% 70% at 18% 108%, color-mix(in oklch, var(--primary) 32%, transparent), transparent 58%)',
              'radial-gradient(ellipse 70% 55% at 78% 118%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 62%)',
              'radial-gradient(ellipse 55% 40% at 52% 92%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)',
              'radial-gradient(ellipse 40% 30% at 92% 78%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 68%)',
              'radial-gradient(ellipse 35% 28% at 8% 72%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 65%)',
            ].join(', '),
          }}
        />

        {/* Desktop area: windows */}
        {windows.map((win, index) => {
          const navItem = navigationItems.find((n) => n.path === win.path);
          if (!navItem) return null;
          const isFocused = win.id === frontWindowId;
          const zIndex = Z_INDEX.WINDOWS_WINDOW_BASE + index;
          return (
            <AppWindow
              key={win.id}
              win={win}
              navItem={navItem}
              currentLanguage={currentLanguage}
              isFocused={isFocused}
              onFocus={() => focusWindow(win.id)}
              onClose={() => closeWindow(win.id)}
              onBoundsChange={(bounds) => updateWindowBounds(win.id, bounds)}
              maxZIndex={maxZIndex}
              zIndex={zIndex}
            />
          );
        })}
      </div>

      {/* Taskbar */}
      <div
        className="fixed left-0 right-0 bottom-0 flex items-center gap-1 px-2 border-t border-border bg-sidebar-background"
        style={{
          height: TASKBAR_HEIGHT,
          zIndex: Z_INDEX.WINDOWS_TASKBAR,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Start button */}
        <div
          className="relative shrink-0"
          ref={startPanelRef}
        >
          <button
            type="button"
            onClick={() => setStartMenuOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2 h-9 px-3 rounded cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              startMenuOpen
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            )}
            aria-expanded={startMenuOpen}
            aria-haspopup="true"
            aria-label="Start"
          >
            {appIcon ? (
              <AppBrandIcon
                appIcon={appIcon}
                title={title}
                linkToHome={false}
                imgClassName="windows-app-icon size-5"
              />
            ) : (
              <StartIcon className="h-5 w-5" />
            )}
            <span className="font-semibold text-sm hidden sm:inline">{title || 'Start'}</span>
          </button>
          {/* Start menu panel */}
          {startMenuOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 flex w-[22rem] max-h-[min(72vh,34rem)] flex-col overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-md"
              style={{ zIndex: Z_INDEX.MODAL_CONTENT }}
              role="menu"
              aria-label={title || 'Applications'}
            >
              <div className="shrink-0 border-b border-border/60 px-4 py-3">
                <p
                  className="text-sm font-semibold tracking-tight"
                  style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                >
                  {title || 'Applications'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose an app to open in a window
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3">
                {startSections.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No applications available
                  </p>
                ) : (
                  startSections.map((section, sectionIndex) => {
                    const categoryLabel =
                      section.type === 'group'
                        ? resolveNavLabel(section.title, currentLanguage)
                        : null;
                    return (
                      <section
                        key={
                          section.type === 'group'
                            ? `group-${categoryLabel}-${sectionIndex}`
                            : `items-${sectionIndex}`
                        }
                        className="space-y-1.5"
                      >
                        {categoryLabel ? (
                          <h2
                            className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                          >
                            {categoryLabel}
                          </h2>
                        ) : null}
                        <div className="space-y-0.5">
                          {section.items.map((item) => {
                            const label = resolveNavLabel(item.label, currentLanguage);
                            const isExternal = item.openIn === 'external';
                            const isOverlay = item.openIn === 'modal' || item.openIn === 'drawer';
                            const icon =
                              item.icon ?? (isExternal ? getExternalFaviconUrl(item.url) : null);
                            const isOpen = openPaths.has(item.path);
                            return (
                              <button
                                key={item.path}
                                type="button"
                                role="menuitem"
                                onClick={() => handleNavClick(item)}
                                className={cn(
                                  'group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                                  'cursor-pointer text-popover-foreground',
                                  'hover:bg-accent hover:text-accent-foreground',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover',
                                  isOpen && 'bg-accent/50',
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                                    'bg-muted/70 text-foreground ring-1 ring-border/50',
                                    'group-hover:bg-background/80 group-hover:ring-border',
                                  )}
                                >
                                  <NavIcon
                                    src={icon}
                                    className="size-4"
                                  />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium leading-tight">
                                    {label}
                                  </span>
                                  {isOpen && !isOverlay && !isExternal ? (
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                      Open
                                    </span>
                                  ) : null}
                                </span>
                                {isExternal ? (
                                  <ExternalLinkIcon className="size-3.5 shrink-0 opacity-50 group-hover:opacity-80" />
                                ) : isOpen && !isOverlay ? (
                                  <span
                                    className="size-1.5 shrink-0 rounded-full bg-primary"
                                    aria-hidden
                                  />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Window list */}
        <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto">
          {windows.map((win) => {
            const navItem = navigationItems.find((n) => n.path === win.path);
            const windowLabel = navItem
              ? resolveNavLabel(navItem.label, currentLanguage)
              : win.label;
            const isFocused = win.id === frontWindowId;
            return (
              <button
                key={win.id}
                type="button"
                onClick={() => focusWindow(win.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  closeWindow(win.id);
                }}
                className={cn(
                  'flex items-center gap-2 h-8 px-2 rounded min-w-0 max-w-[140px] shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isFocused
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
                title={windowLabel}
              >
                {win.icon ? (
                  <img
                    src={win.icon}
                    alt=""
                    className={cn(
                      'h-4 w-4 shrink-0 rounded-sm object-cover',
                      isAppIcon(win.icon) && 'opacity-90 dark:opacity-100 dark:invert',
                    )}
                  />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-sm bg-muted" />
                )}
                <span className="text-xs truncate">{windowLabel}</span>
              </button>
            );
          })}
        </div>

        {/* End navigation items (right side of taskbar) */}
        {endNavItems.length > 0 && (
          <div className="flex items-center gap-0.5 shrink-0 border-l border-sidebar-border pl-2 ml-1">
            {endNavItems.map((item) => {
              const label =
                typeof item.label === 'string'
                  ? item.label
                  : resolveNavLabel(item.label, currentLanguage);
              const icon =
                item.icon ?? (item.openIn === 'external' ? getExternalFaviconUrl(item.url) : null);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className="flex items-center gap-2 h-8 px-2 rounded cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  title={label}
                >
                  {icon ? (
                    <img
                      src={icon}
                      alt=""
                      className={cn(
                        'h-4 w-4 shrink-0 rounded-sm object-cover',
                        isAppIcon(icon) && 'opacity-90 dark:opacity-100 dark:invert',
                      )}
                    />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-sm bg-muted" />
                  )}
                  <span className="text-xs truncate max-w-[100px]">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center shrink-0 border-l border-sidebar-border pl-2 ml-1">
          <LoginButton
            variant="windows"
            hideWhenLoggedOut={hasCustomLoginNav}
          />
        </div>

        {/* Date and time (extreme bottom right, OS-style); uses region timezone from settings */}
        <div
          className="flex flex-col items-end justify-center shrink-0 px-3 py-1 text-sidebar-foreground border-l border-sidebar-border ml-1 min-w-0"
          style={{ paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
          role="timer"
          aria-live="off"
          aria-label={new Intl.DateTimeFormat(currentLanguage, {
            timeZone,
            dateStyle: 'full',
            timeStyle: 'medium',
          }).format(now)}
        >
          <time
            dateTime={now.toISOString()}
            className="text-xs leading-tight tabular-nums whitespace-nowrap"
          >
            {new Intl.DateTimeFormat(currentLanguage, {
              timeZone,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(now)}
          </time>
          <time
            dateTime={now.toISOString()}
            className="text-[10px] leading-tight whitespace-nowrap text-sidebar-foreground/90"
          >
            {new Intl.DateTimeFormat(currentLanguage, {
              timeZone,
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }).format(now)}
          </time>
        </div>
      </div>
    </>
  );
}
