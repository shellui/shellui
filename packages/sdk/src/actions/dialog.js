import { shellui } from '../index.js';
import { generateUuid } from '../utils/uuid.js';

/**
 * Dialog mode types
 * @typedef {'ok' | 'okCancel' | 'delete' | 'confirm' | 'onlyCancel'} DialogMode
 */

/**
 * Shows a dialog
 * @param {Object} options - Dialog options
 * @param {string} [options.id] - Optional dialog ID. If provided, updates existing dialog instead of creating new one
 * @param {string} options.title - Dialog title
 * @param {string} [options.description] - Dialog description
 * @param {DialogMode} [options.mode='ok'] - Dialog mode: 'ok', 'okCancel', 'delete', 'confirm', 'onlyCancel'
 * @param {Function} [options.onOk] - OK/Confirm button callback
 * @param {Function} [options.onCancel] - Cancel button callback
 * @param {string} [options.okLabel] - Custom OK button label
 * @param {string} [options.cancelLabel] - Custom Cancel button label
 * @returns {string|void} Returns the dialog ID if created, void if updating or in SSR
 * If inside an iframe, sends a message to the parent to show the dialog
 * If not in an iframe, dispatches a custom event that can be handled by the app
 */
export function dialog(options = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  // Use provided ID or generate a unique dialog ID
  const dialogId = options.id || generateUuid();

  // Store callbacks if they exist
  if (options.onOk || options.onCancel) {
    shellui.callbackRegistry.register(dialogId, {
      action: options.onOk,
      cancel: options.onCancel,
    });
  }

  // Determine message type: update if ID was provided, otherwise create
  const messageType = options.id ? 'SHELLUI_DIALOG_UPDATE' : 'SHELLUI_DIALOG';

  // Send message to parent frame to show/update dialog
  const message = {
    type: messageType,
    payload: {
      id: dialogId,
      title: options.title,
      description: options.description,
      mode: options.mode || 'ok',
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
      // Remove callbacks because not serializable
      onOk: undefined,
      onCancel: undefined,
    }
  };

  // Check if we're inside an iframe
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }

  // Return the dialog ID if this is a new dialog
  return options.id ? undefined : dialogId;
}
