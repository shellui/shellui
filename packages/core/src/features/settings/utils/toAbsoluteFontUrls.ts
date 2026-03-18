/** Convert font file URLs to absolute so iframes/modals on other ports or domains can load them. */
export const toAbsoluteFontUrls = (urls: string[]): string[] => {
  if (typeof window === 'undefined') return urls;
  const origin = window.location.origin;

  return urls.map((url) => {
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${origin}${path}`;
  });
};
