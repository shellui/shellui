import { shellui } from '../index';
import { generateUuid } from '../utils/uuid.js';
/**
 * Shows a toast notification
 * @param {Object} options - Toast options
 * @param {string} [options.id] - Optional toast ID. If provided, updates existing toast instead of creating new one
 * @param {string} [options.title] - Toast title
 * @param {string} [options.description] - Toast description
 * @param {string} [options.type='default'] - Toast type: 'default', 'success', 'error', 'warning', 'info', 'loading'
 * @param {number} [options.duration] - Toast duration in milliseconds
 * @param {Object} [options.action] - Action button configuration
 * @param {string} options.action.label - Action button label
 * @param {Function} options.action.onClick - Action button click handler
 * @param {Object} [options.cancel] - Cancel button configuration
 * @param {string} options.cancel.label - Cancel button label
 * @param {Function} options.cancel.onClick - Cancel button click handler
 * @returns {string|void} Returns the toast ID if created, void if updating or in SSR
 * If inside an iframe, sends a message to the parent to show the toast
 * If not in an iframe, dispatches a custom event that can be handled by the app
 */
export function toast(options = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  // Use provided ID or generate a unique toast ID
  const toastId = options.id || generateUuid();

  // Store action and cancel handlers if they exist
  if (options.action?.onClick || options.cancel?.onClick) {
    shellui.callbackRegistry.register(toastId, {
      action: options.action?.onClick,
      cancel: options.cancel?.onClick,
    });
  }

  // Determine message type: update if ID was provided, otherwise create
  const messageType = options.id ? 'SHELLUI_TOAST_UPDATE' : 'SHELLUI_TOAST';

  // Send message to parent frame to show/update toast
  const message = {
    type: messageType,
    payload: {
      id: toastId,
      title: options.title,
      description: options.description,
      type: options.type || 'default',
      duration: options.duration,
      action: {
        ...options.action,
        onClick: undefined, // Remove fct because not serializable
      },
      cancel: {
        ...options.cancel,
        onClick: (undefined), // Remove fct because not serializable
      },
    }
  };

  // Check if we're inside an iframe
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }

  // Return the toast ID if this is a new toast
  return options.id ? undefined : toastId;
}
