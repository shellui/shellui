import { shellui } from '../index.js';
import { generateUuid } from '../utils/uuid.js';
import type { ToastOptions } from '../types.js';

/**
 * Shows a toast notification
 * If inside an iframe, sends a message to the parent to show the toast
 * If not in an iframe, dispatches a custom event that can be handled by the app
 * @returns The toast ID if created, void if updating or in SSR
 */
export function toast(options: ToastOptions = {}): string | void {
  if (typeof window === 'undefined') {
    return;
  }

  const toastId = options.id ?? generateUuid();

  if (options.action?.onClick || options.cancel?.onClick) {
    shellui.callbackRegistry.register(toastId, {
      action: options.action?.onClick,
      cancel: options.cancel?.onClick,
    });
  }

  const messageType = options.id ? 'SHELLUI_TOAST_UPDATE' : 'SHELLUI_TOAST';

  const message = {
    type: messageType,
    payload: {
      id: toastId,
      title: options.title,
      description: options.description,
      type: options.type ?? 'default',
      duration: options.duration,
      position: options.position,
      action: {
        ...options.action,
        onClick: undefined,
      },
      cancel: {
        ...options.cancel,
        onClick: undefined,
      },
    },
  };

  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }

  return options.id ? undefined : toastId;
}
