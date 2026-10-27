/**
 * Active nav contrast guard.
 *
 * The solid active pill paints `--sidebar-primary-foreground` on `--sidebar-primary`.
 * Some themes pair those two below WCAG AA (4.5:1). For those, `applyTheme` sets
 * `html[data-shellui-nav-contrast="low"]` and the chrome switches to a tinted pill.
 *
 * Parses the colour formats themes use: oklch(), #rrggbb, hsl() and legacy
 * `H S% L%` channels. Anything else returns null (guard stays off).
 */

export const NAV_CONTRAST_MIN = 4.5;
export const NAV_CONTRAST_ATTR = 'data-shellui-nav-contrast';

type Rgb = [number, number, number];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function parseNumber(token: string, percentScale: number): number | null {
  const t = token.trim();
  if (t === 'none') return 0;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return null;
  return t.endsWith('%') ? (n / 100) * percentScale : n;
}

/** OKLCH to linear sRGB (Björn Ottosson's matrices), clamped to the gamut. */
function oklchToLinearRgb(L: number, C: number, H: number): Rgb {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function hslToLinearRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [srgbToLinear(f(0)), srgbToLinear(f(8)), srgbToLinear(f(4))];
}

/** Linear sRGB for a theme colour value, or null when the format is unknown. */
export function parseThemeColor(value: string | undefined | null): Rgb | null {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();

  const hex = v.match(/^#?([0-9a-f]{6})$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [
      srgbToLinear(((n >> 16) & 255) / 255),
      srgbToLinear(((n >> 8) & 255) / 255),
      srgbToLinear((n & 255) / 255),
    ];
  }

  const ok = v.match(/^oklch\(\s*([^\s/]+)\s+([^\s/]+)\s+([^\s/)]+)/);
  if (ok) {
    const L = parseNumber(ok[1], 1);
    const C = parseNumber(ok[2], 0.4);
    const H = parseNumber(ok[3], 360);
    if (L === null || C === null || H === null) return null;
    return oklchToLinearRgb(L, C, H);
  }

  const hsl = v.match(/^(?:hsla?\()?\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (hsl) {
    return hslToLinearRgb(parseFloat(hsl[1]), parseFloat(hsl[2]) / 100, parseFloat(hsl[3]) / 100);
  }

  return null;
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** WCAG 2 contrast ratio between two theme colours, or null when either is unparsable. */
export function contrastRatio(
  a: string | undefined | null,
  b: string | undefined | null,
): number | null {
  const ca = parseThemeColor(a);
  const cb = parseThemeColor(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** True when the solid active pill would fall under 4.5:1 for this mode. */
export function isLowNavContrast(
  sidebarPrimary?: string | null,
  sidebarPrimaryForeground?: string | null,
): boolean {
  const ratio = contrastRatio(sidebarPrimary, sidebarPrimaryForeground);
  return ratio !== null && ratio < NAV_CONTRAST_MIN;
}
