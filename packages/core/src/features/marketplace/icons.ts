/** True when a nav icon must not be injected as markup. Remote URLs render as images. */
export function isUnsafeNavIconSrc(src: string): boolean {
  const trimmed = src.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith('<svg') || trimmed.includes('<svg')) return true;
  if (trimmed.startsWith('data:image/svg')) return true;
  return false;
}

export function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

/** HTTPS icon, or http on localhost. Inline SVG is refused. */
export function safeRemoteIconUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || isUnsafeNavIconSrc(trimmed)) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'https:') return url.toString();
    if (url.protocol === 'http:' && isLocalDevHost(url.hostname)) return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}
