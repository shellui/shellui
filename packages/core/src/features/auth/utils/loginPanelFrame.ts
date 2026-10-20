import { addIframe, removeIframe } from '@shellui/sdk';

/**
 * Register the login side panel iframe with the SDK frame registry so it receives
 * SHELLUI_SETTINGS broadcasts (theme, language) like main content frames.
 * Returns a cleanup that unregisters it.
 */
export function registerLoginPanelFrame(node: HTMLIFrameElement | null): () => void {
  if (!node) return () => {};
  const iframeId = addIframe(node);
  return () => {
    removeIframe(iframeId);
  };
}
