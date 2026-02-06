import { shellui } from '../index.js';
import { generateUuid } from '../utils/uuid.js';
import type { DialogOptions } from '../types.js';

/**
 * Shows a dialog
 * If inside an iframe, sends a message to the parent to show the dialog
 * If not in an iframe, dispatches a custom event that can be handled by the app
 * @returns The dialog ID if created, void if updating or in SSR
 */
export function dialog(options?: DialogOptions): string | void {
  if (typeof window === 'undefined' || !options) {
    return;
  }

  const dialogId = options.id ?? generateUuid();

  if (options.onOk || options.onCancel || options.secondaryButton?.onClick) {
    shellui.callbackRegistry.register(dialogId, {
      action: options.onOk,
      cancel: options.onCancel,
      secondary: options.secondaryButton?.onClick,
    });
  }

  const messageType = options.id ? 'SHELLUI_DIALOG_UPDATE' : 'SHELLUI_DIALOG';

  const message = {
    type: messageType,
    payload: {
      id: dialogId,
      title: options.title,
      description: options.description,
      mode: options.mode ?? 'ok',
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
      size: options.size,
      position: options.position,
      secondaryButton: options.secondaryButton
        ? {
            label: options.secondaryButton.label,
            onClick: undefined,
          }
        : undefined,
      icon: options.icon,
      onOk: undefined,
      onCancel: undefined,
    },
  };

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }

  return options.id ? undefined : dialogId;
}
