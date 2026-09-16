/**
 * Shell / overlay viewport helpers.
 *
 * `--shellui-app-height` is defined in CSS as `100dvh` (see index.html / index.css).
 * Overlay clamps and CSS max-heights should derive from that — never raw
 * `innerHeight` alone.
 */

const APP_HEIGHT_VAR = '--shellui-app-height';

/** Read a CSS length on :root (px). `env(safe-area-*)` resolves through a probe. */
function readRootLengthPx(cssLength: string): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    `padding-top:${cssLength}`;
  document.documentElement.appendChild(probe);
  const value = Number.parseFloat(getComputedStyle(probe).paddingTop);
  probe.remove();
  return Number.isFinite(value) ? value : 0;
}

export function readSafeAreaInsetTop(): number {
  return readRootLengthPx('var(--shellui-safe-area-top, env(safe-area-inset-top, 0px))');
}

export function readSafeAreaInsetBottom(): number {
  return readRootLengthPx('var(--shellui-safe-area-bottom, env(safe-area-inset-bottom, 0px))');
}

/** Current shell height in CSS pixels (falls back to innerHeight). */
export function readAppHeightPx(): number {
  if (typeof window === 'undefined') return 0;
  if (typeof document !== 'undefined') {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(APP_HEIGHT_VAR).trim();
    if (raw.endsWith('px')) {
      const px = Number.parseFloat(raw);
      if (Number.isFinite(px) && px > 0) return px;
    }
    // Resolve dvh/vh/% via a probe so browser-tab fallback still works.
    if (raw) {
      const viaProbe = readRootLengthPx(raw);
      if (viaProbe > 0) return viaProbe;
    }
  }
  return window.innerHeight;
}

/**
 * Max height for modals / sheets / drawers (content-sized clamps).
 * Leaves the top safe area + a small margin so a bottom sheet cannot cover the
 * status bar controls; the sheet itself may still paint into the home-indicator
 * band (footer chrome owns that inset).
 */
export function overlayMaxHeightPx(ratio = 0.92): number {
  const appH = readAppHeightPx();
  const top = readSafeAreaInsetTop();
  const available = Math.max(0, appH - top - 8);
  return Math.floor(available * ratio);
}

/** CSS expression matching {@link overlayMaxHeightPx} for inline styles. */
export function overlayMaxHeightCss(): string {
  return 'var(--shellui-overlay-max-height)';
}
