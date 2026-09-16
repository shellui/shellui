/**
 * Theme color values are full CSS colors (preferred: OKLCH).
 * Legacy HSL channel triples (`"H S% L%"`) are wrapped as `hsl(...)`.
 * Hex is normalized to `#RRGGBB`.
 */

const HEX_RE = /^#?([0-9A-Fa-f]{6})$/;
const HSL_CHANNELS_RE = /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;

/**
 * Convert hex color (`#RRGGBB` or `RRGGBB`) to HSL channels (`H S% L%`).
 * Kept for tests / legacy helpers. Prefer `toCssVarValue` for runtime CSS vars.
 */
export function hexToHsl(hexString: string): string {
  if (!hexString || typeof hexString !== 'string') {
    return hexString;
  }

  const trimmed = hexString.trim();
  if (!HEX_RE.test(trimmed)) {
    return trimmed;
  }

  const hex = trimmed.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return hexString;
  }

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6;
        break;
    }
  }

  const hDeg = Math.round(h * 360 * 10) / 10;
  const sPercent = Math.round(s * 100 * 10) / 10;
  const lPercent = Math.round(l * 100 * 10) / 10;

  return `${hDeg} ${sPercent}% ${lPercent}%`;
}

/**
 * Normalize a token for use as a CSS variable value.
 * Variables are consumed as full colors via `var(--token)` (shadcn OKLCH style).
 */
export function toCssVarValue(value: string): string {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (HSL_CHANNELS_RE.test(trimmed)) return `hsl(${trimmed})`;
  if (HEX_RE.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
  return trimmed;
}

export function isHexColor(value: string): boolean {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}
