/**
 * Companion/content iframe sandbox tokens.
 *
 * Valid HTTP(S) companion URLs (both cross-origin dev/prod apps and same-origin
 * `/app/` or hash-routed apps) and shell routes keep `allow-same-origin`.
 * Omitting `allow-same-origin` gives the frame an opaque origin (`null`), which
 * breaks Vite `<script type="module" crossorigin>` and stylesheet fetches via
 * CORS, breaks Shellui SDK `postMessage` origin checks, and breaks same-origin
 * nested admin frames (`isAdminContentFrame`).
 *
 * Unparseable URLs, empty URLs, and non-HTTP(S) schemes (such as `data:` or
 * `javascript:`) omit `allow-same-origin`.
 *
 * `allow-popups-to-escape-sandbox` is not granted, so popups stay sandboxed.
 */

const SANDBOX_WITH_ORIGIN = 'allow-same-origin allow-scripts allow-forms allow-popups';
const SANDBOX_OPAQUE_ORIGIN = 'allow-scripts allow-forms allow-popups';

/** @deprecated use the sandbox returned by resolveContentIframeSandbox */
export const LEGACY_POPUP_ESCAPE_TOKEN = 'allow-popups-to-escape-sandbox';

/** @deprecated No-op retained for callers that reset sandbox warning state in tests. */
export function resetContentIframeSandboxWarnings(): void {}

/**
 * Resolve the `sandbox` attribute for a main content iframe.
 *
 * @param iframeUrl - Absolute or relative URL loaded in the iframe
 * @param shellOrigin - Optional shell origin (for unit tests without `window`)
 */
export function resolveContentIframeSandbox(iframeUrl: string, shellOrigin?: string): string {
  const trimmed = iframeUrl.trim();
  if (!trimmed) return SANDBOX_OPAQUE_ORIGIN;

  try {
    const base =
      typeof window !== 'undefined' ? window.location.href : (shellOrigin ?? 'http://localhost/');
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return SANDBOX_WITH_ORIGIN;
    }
    const baseUrl = new URL(base);
    if (parsed.host !== '' && parsed.protocol === baseUrl.protocol) {
      return SANDBOX_WITH_ORIGIN;
    }
    return SANDBOX_OPAQUE_ORIGIN;
  } catch {
    return SANDBOX_OPAQUE_ORIGIN;
  }
}
