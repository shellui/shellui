/**
 * Companion/content iframe sandbox tokens.
 *
 * Threat model (Track F / M-18):
 * - Dev: shell (:4000) and companion (:5173, :3000, …) use distinct origins; templates
 *   set `frame-ancestors` so companions accept shell framing.
 * - Prod: companion is served from the same origin as the shell (`/app/`), which keeps
 *   postMessage and cookies workable while avoiding cross-origin framing surprises.
 * - `allow-same-origin` + `allow-scripts` lets embedded scripts remove the sandbox
 *   attribute when the iframe is same-origin to its document — acceptable only for
 *   trusted navigation URLs you configure. Residual risk is documented in
 *   docs/features/companion-isolation.md.
 *
 * Incremental tightening: drop `allow-popups-to-escape-sandbox` (popups stay sandboxed).
 */
const SANDBOX_CONTENT = 'allow-same-origin allow-scripts allow-forms allow-popups';

/** @deprecated use SANDBOX_CONTENT — kept for tests asserting legacy tokens are gone */
export const LEGACY_POPUP_ESCAPE_TOKEN = 'allow-popups-to-escape-sandbox';

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
    // Same-origin vs cross-origin companions share the tightened token set today.
    // Cross-origin dev companions still require `allow-same-origin` for companion
    // cookies/localStorage on their own origin; distinct-origin framing is the isolation layer.
    void iframeOrigin;
    void parentOrigin;
    return SANDBOX_CONTENT;
  } catch {
    return SANDBOX_CONTENT;
  }
}
