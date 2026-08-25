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

/** True when the icon is a local app icon (/icons/); external images (avatars, favicons) are shown as-is. */
export function isAppIcon(src: string): boolean {
  return src.startsWith('/icons/');
}
