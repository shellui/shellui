/**
 * Outbound postMessage helper for SDK → shell traffic (concrete target origins).
 */

import { resolveParentTargetOrigin, resolveSelfTargetOrigin } from './messageSecurity.js';

export function postShellMessage(message: { type: string; payload?: unknown }): void {
  if (typeof window === 'undefined') return;

  const embedded = window.parent !== window;
  const targetOrigin = embedded ? resolveParentTargetOrigin() : resolveSelfTargetOrigin();
  if (!targetOrigin || targetOrigin === '*') return;
  const target = embedded ? window.parent : window;
  target.postMessage(message, targetOrigin);
}
