/** DuckDuckGo favicon URL for a given page URL (used when openIn === 'external' and no icon is set). */
export function getExternalFaviconUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (!hostname) return null;
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return null;
  }
}

/** Approximate width per slot (icon + label + padding) and gap for dynamic slot count. */
export const BOTTOM_NAV_SLOT_WIDTH = 64;
export const BOTTOM_NAV_GAP = 4;
export const BOTTOM_NAV_PX = 12;
/** Max slots in the row (Home + nav + optional More) to avoid overflow/duplicated wrap. */
export const BOTTOM_NAV_MAX_SLOTS = 6;

/** True when the icon is a local app icon (/icons/); external images (avatars, favicons) are shown as-is. */
export function isAppIcon(src: string): boolean {
  return src.startsWith('/icons/');
}
