/**
 * Companion/content iframe sandbox tokens.
 *
 * Dev companions run on another origin (another localhost port). They keep
 * `allow-same-origin` so cookies and storage stay on that origin.
 *
 * A companion URL on the shell origin (the production `/app/` path, or any
 * other same-origin path that is not a shell page) does not get
 * `allow-same-origin`. The frame then has its own opaque origin. The shell
 * warns once per URL. Host that companion on its own origin when it needs
 * cookies, storage, or a concrete postMessage origin.
 *
 * Shell pages (settings, cookie preferences, login, and the other shell
 * routes) stay on the shell origin.
 *
 * `allow-popups-to-escape-sandbox` is not granted, so popups stay sandboxed.
 */
import { isShellOwnedPath } from '../features/layouts/floating/isShellOwnedPath';

const SANDBOX_WITH_ORIGIN = 'allow-same-origin allow-scripts allow-forms allow-popups';
const SANDBOX_OPAQUE_ORIGIN = 'allow-scripts allow-forms allow-popups';

/** @deprecated use the sandbox returned by resolveContentIframeSandbox */
export const LEGACY_POPUP_ESCAPE_TOKEN = 'allow-popups-to-escape-sandbox';

const warnedSameOriginCompanions = new Set<string>();

/** Test helper. Production code warns once per shell origin and companion URL. */
export function resetContentIframeSandboxWarnings(): void {
  warnedSameOriginCompanions.clear();
}

function warnSameOriginCompanion(iframeUrl: string, shellOrigin: string): void {
  let path = iframeUrl;
  try {
    path = new URL(iframeUrl, shellOrigin).pathname;
  } catch {
    // Keep the raw value when it is not a URL.
  }
  const key = `${shellOrigin} ${path}`;
  if (warnedSameOriginCompanions.has(key)) return;
  warnedSameOriginCompanions.add(key);
  // eslint-disable-next-line no-console -- operators need this without debug logging
  console.warn(
    `Shellui: companion path ${path} is on the shell origin (${shellOrigin}). The content iframe sandbox omits allow-same-origin. Host this companion on its own origin so it keeps cookies, storage, and a concrete postMessage origin.`,
  );
}

function isSameOriginCompanion(
  iframeUrl: string,
  iframeOrigin: string,
  shellOrigin: string,
): boolean {
  if (iframeOrigin !== shellOrigin) return false;
  try {
    return !isShellOwnedPath(new URL(iframeUrl, shellOrigin).pathname);
  } catch {
    return true;
  }
}

/**
 * Resolve the `sandbox` attribute for a main content iframe.
 *
 * @param iframeUrl - Absolute or relative URL loaded in the iframe
 * @param shellOrigin - Optional shell origin (for unit tests without `window`)
 */
export function resolveContentIframeSandbox(iframeUrl: string, shellOrigin?: string): string {
  try {
    const base =
      typeof window !== 'undefined' ? window.location.href : (shellOrigin ?? 'http://localhost/');
    const iframeOrigin = new URL(iframeUrl, base).origin;
    const parentOrigin =
      shellOrigin ?? (typeof window !== 'undefined' ? window.location.origin : iframeOrigin);
    if (isSameOriginCompanion(iframeUrl, iframeOrigin, parentOrigin)) {
      warnSameOriginCompanion(iframeUrl, parentOrigin);
      return SANDBOX_OPAQUE_ORIGIN;
    }
    return SANDBOX_WITH_ORIGIN;
  } catch {
    warnSameOriginCompanion(iframeUrl, shellOrigin ?? 'unknown');
    return SANDBOX_OPAQUE_ORIGIN;
  }
}
