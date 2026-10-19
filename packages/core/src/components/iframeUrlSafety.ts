/**
 * URL checks for content iframes driven by the shell.
 *
 * The desktop app serves the shell from a custom scheme (`tauri://localhost` on
 * macOS and Linux), so relative nav URLs like `/app#/dialog` resolve to that
 * scheme. Those are as safe as the shell itself. Anything else must be http(s).
 * `javascript:`, `data:` and other schemes are always refused.
 */

type ShellLocation = Pick<Location, 'href' | 'protocol' | 'host'>;

const currentShellLocation = (): ShellLocation | undefined =>
  typeof window !== 'undefined' ? window.location : undefined;

const parse = (url: string, base?: string): URL | null => {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
};

/** Protocol + host, which stays meaningful for custom schemes whose `.origin` is "null". */
const originKey = (url: URL): string => `${url.protocol}//${url.host}`;

const isShellOrigin = (url: URL, shell: ShellLocation): boolean =>
  // Only hierarchical URLs with a host can match (`javascript:` and `data:` have none).
  url.host !== '' && url.protocol === shell.protocol && url.host === shell.host;

export function isSafeIframeUrl(
  url: string,
  shell: ShellLocation | undefined = currentShellLocation(),
): boolean {
  const parsed = parse(url, shell?.href);
  if (!parsed) return false;
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
  return shell ? isShellOrigin(parsed, shell) : false;
}

export function isSameOrigin(
  targetUrl: string,
  allowedUrl: string,
  shell: ShellLocation | undefined = currentShellLocation(),
): boolean {
  const target = parse(targetUrl, shell?.href);
  const allowed = parse(allowedUrl, shell?.href);
  if (!target || !allowed) return false;
  if (!target.host || !allowed.host) return false;
  return originKey(target) === originKey(allowed);
}
