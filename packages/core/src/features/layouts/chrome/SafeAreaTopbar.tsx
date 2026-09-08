import { useEffect } from 'react';
import { cn } from '../../../lib/utils';

/** True when this window is the outermost shell (not nested in an iframe). */
export function isShellUiRootWindow(): boolean {
  return typeof window !== 'undefined' && window.parent === window;
}

/**
 * Root shell only: advertise the safe-area topbar on <html> so fixed chrome
 * (sidebar, drawers) can clear it. Nested iframe shells skip this.
 */
export function SafeAreaTopbarOffset({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.setAttribute('data-shellui-safe-area-topbar', '');
    return () => root.removeAttribute('data-shellui-safe-area-topbar');
  }, [enabled]);

  return null;
}

/**
 * Tablet / desktop band for top safe-area. Height is 0 when the inset is 0;
 * overflow clips the border so no stray hairline. Hidden below md — mobile
 * headers pad into the status band instead.
 */
export function SafeAreaTopbarStrip({
  enabled,
  className,
}: {
  enabled: boolean;
  /** Outer strip classes (defaults match sidebar chrome). */
  className?: string;
}) {
  if (!enabled) return null;
  return (
    <div
      aria-hidden
      data-slot="shellui-safe-area-top"
      className={cn('relative z-0 hidden shrink-0 overflow-hidden md:block', className)}
      style={{ height: 'var(--shellui-safe-area-top)' }}
    >
      <div className="box-border h-full border-b border-sidebar-border bg-sidebar" />
    </div>
  );
}
