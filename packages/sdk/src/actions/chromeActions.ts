import { shellui } from '../index.js';
import { getLogger } from '../logger/logger.js';
import type { ChromeActionsSpec } from '../types.js';
import { clampChromeActions } from './clampChromeActions.js';

const logger = getLogger('shellsdk');

/** Ids registered by the last `actions.set` call (cleared on next set / clear). */
let activeActionIds: string[] = [];

function postToShell(type: 'SHELLUI_ACTIONS_SET' | 'SHELLUI_ACTIONS_CLEAR', payload: object): void {
  if (typeof window === 'undefined') return;
  const message = { type, payload };
  // Known limitation: wildcard target origin (same as toast/dialog/modal).
  // Any listener on the parent page can observe action ids/labels. Prefer a
  // locked origin once the shell ↔ iframe origin contract is explicit.
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}

function clearRegisteredCallbacks(): void {
  for (const id of activeActionIds) {
    shellui.callbackRegistry.clear(id);
  }
  activeActionIds = [];
}

/**
 * Declarative floating action chrome owned by the shell.
 *
 * ```ts
 * shellui.actions.set({
 *   back: { id: 'back', onClick: () => history.back() },
 *   title: 'Inbox',
 *   trailing: [{ id: 'edit', label: 'Edit', onClick: () => {} }],
 *   primary: { id: 'compose', icon: 'plus', onClick: () => {} },
 * });
 * shellui.actions.clear();
 * ```
 *
 * Re-call `set` or `clear` on your own SPA navigations — Shellui does not
 * infer actions from the iframe URL.
 *
 * Messages use `postMessage(..., '*')` today (same as other SDK → shell
 * actions). Treat action labels/ids as visible to any same-page listener on
 * the parent; tightening the target origin is tracked as a known limitation
 * before GA.
 */
export const actions = {
  set(spec: ChromeActionsSpec): void {
    if (typeof window === 'undefined') return;

    const { payload, callbackIds, warnings } = clampChromeActions(spec);
    for (const warning of warnings) {
      logger.warn(warning);
    }

    clearRegisteredCallbacks();

    const register = (id: string, onClick?: () => void) => {
      if (!onClick) return;
      shellui.callbackRegistry.register(id, { action: onClick });
    };

    if (spec.back?.id && payload.back) register(spec.back.id, spec.back.onClick);
    for (const item of spec.trailing ?? []) {
      if (item?.id && callbackIds.includes(item.id)) register(item.id, item.onClick);
    }
    if (spec.primary?.id && payload.primary) register(spec.primary.id, spec.primary.onClick);

    activeActionIds = [...callbackIds];
    postToShell('SHELLUI_ACTIONS_SET', payload);
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    clearRegisteredCallbacks();
    postToShell('SHELLUI_ACTIONS_CLEAR', {});
  },
};
