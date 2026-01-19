import { shellui } from '../index';
/**
 * Shows a toast notification
 * @param {Object} options - Toast options
 * @param {string} [options.title] - Toast title
 * @param {string} [options.description] - Toast description
 * @param {string} [options.type='default'] - Toast type: 'default', 'success', 'error', 'warning', 'info'
 * @param {number} [options.duration] - Toast duration in milliseconds
 * @param {Object} [options.action] - Action button configuration
 * @param {string} options.action.label - Action button label
 * @param {Function} options.action.onClick - Action button click handler
 * @param {Object} [options.cancel] - Cancel button configuration
 * @param {string} options.cancel.label - Cancel button label
 * @param {Function} options.cancel.onClick - Cancel button click handler
 * If inside an iframe, sends a message to the parent to show the toast
 * If not in an iframe, dispatches a custom event that can be handled by the app
 */
export function toast(options = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  // Send message to parent frame to show toast
  const message = {
    type: 'SHELLUI_TOAST',
    payload: {
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
        onClick: undefined, // Remove fct because not serializable
      },
    }
  };

  // Check if we're inside an iframe
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    window.postMessage(message, '*');
  }
}
