/**
 * Outbound postMessage helper for SDK → shell traffic (concrete target origins).
 */

import { resolveParentTargetOrigin, resolveSelfTargetOrigin } from './messageSecurity.js';

export function postShellMessage(message: { type: string; payload?: unknown }): void {
  if (typeof window === 'undefined') return;

  const targetOrigin =
    window.parent !== window ? resolveParentTargetOrigin() : resolveSelfTargetOrigin();
  const target = window.parent !== window ? window.parent : window;
  target.postMessage(message, targetOrigin);
}
