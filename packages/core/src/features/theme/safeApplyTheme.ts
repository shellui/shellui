import { applyTheme } from './applyTheme';
import type { ThemeDefinition } from './types';

const SWITCHING_CLASS = 'shellui-theme-switching';
/** Keep transitions locked briefly after apply so rapid paints stay snap-clean. */
const UNLOCK_MS = 180;

let unlockTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { theme: ThemeDefinition; isDark: boolean } | null = null;
let flushScheduled = false;
let switchGeneration = 0;
let lastAppliedKey: string | null = null;
const idleWaiters = new Set<() => void>();

function applyDarkClass(isDark: boolean): void {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function themeApplyKey(theme: ThemeDefinition, isDark: boolean): string {
  return `${theme.name}:${isDark ? 'dark' : 'light'}`;
}

function notifyIdle(): void {
  if (idleWaiters.size === 0) return;
  const waiters = [...idleWaiters];
  idleWaiters.clear();
  for (const resolve of waiters) {
    resolve();
  }
}

function beginSwitchLock(): void {
  document.documentElement.classList.add(SWITCHING_CLASS);
  if (unlockTimer !== null) {
    clearTimeout(unlockTimer);
    unlockTimer = null;
  }
}

function endSwitchLockSoon(): void {
  if (unlockTimer !== null) {
    clearTimeout(unlockTimer);
  }
  const generation = switchGeneration;
  unlockTimer = setTimeout(() => {
    // A newer switch started while we were waiting — let that cycle unlock.
    if (generation !== switchGeneration) return;
    document.documentElement.classList.remove(SWITCHING_CLASS);
    unlockTimer = null;
    notifyIdle();
  }, UNLOCK_MS);
}

function flushPending(): void {
  flushScheduled = false;
  const next = pending;
  pending = null;
  if (!next || typeof document === 'undefined') {
    endSwitchLockSoon();
    return;
  }

  const key = themeApplyKey(next.theme, next.isDark);
  // Skip no-op reapplies (e.g. iframe settings echo) that cause light/dark bouncing.
  if (key === lastAppliedKey) {
    endSwitchLockSoon();
    return;
  }

  switchGeneration += 1;
  beginSwitchLock();
  applyDarkClass(next.isDark);
  applyTheme(next.theme, next.isDark);
  lastAppliedKey = key;
  // Force style recalc so the locked frame commits without CSS transitions.
  void document.documentElement.offsetHeight;
  endSwitchLockSoon();
}

/**
 * True while a theme switch is in flight (queued, applying, or unlock grace).
 */
export function isThemeSwitchInFlight(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    pending !== null ||
    flushScheduled ||
    unlockTimer !== null ||
    document.documentElement.classList.contains(SWITCHING_CLASS)
  );
}

/**
 * Resolves when the current theme switch (if any) has fully settled.
 */
export function waitForThemeSwitchIdle(): Promise<void> {
  if (!isThemeSwitchInFlight()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    idleWaiters.add(resolve);
  });
}

/**
 * Apply theme + light/dark class safely for rapid switching.
 * Coalesces to the latest request within the same turn and temporarily
 * disables CSS color transitions so the UI snaps instead of morphing.
 */
export function scheduleSafeThemeApply(theme: ThemeDefinition, isDark: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  pending = { theme, isDark };
  beginSwitchLock();

  if (flushScheduled) {
    return;
  }

  flushScheduled = true;
  queueMicrotask(flushPending);
}

/**
 * Synchronous safe apply (e.g. tests). Still uses the transition lock.
 */
export function applyThemeSafely(theme: ThemeDefinition, isDark: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  pending = null;
  flushScheduled = false;
  switchGeneration += 1;
  beginSwitchLock();
  applyDarkClass(isDark);
  applyTheme(theme, isDark);
  lastAppliedKey = themeApplyKey(theme, isDark);
  void document.documentElement.offsetHeight;
  endSwitchLockSoon();
}
