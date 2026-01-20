/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

import { setupUrlMonitoring } from './utils/setupUrlMonitoring.js';
import { setupKeyListener } from './utils/setupKeyListener.js';
import { openModal as openModalAction } from './actions/openModal.js';
import { toast as toastAction } from './actions/toast.js';
import { getLogger } from './logger/logger.js';
import { FrameRegistry } from './utils/frameRegistry.js';
import { MessageListenerRegistry } from './utils/messageListenerRegistry.js';
import { CallbackRegistry } from './utils/callbackRegistry.js';
import packageJson from '../package.json';

const logger = getLogger('shellsdk');

class ShellUISDK {
  constructor() {
    this.initialized = false;
    // Don't access window in constructor - it may not exist during SSR
    this.currentPath = typeof window !== 'undefined'
      ? window.location.pathname + window.location.search + window.location.hash
      : '';
    this.version = packageJson.version;
    // Frame registry for managing iframe references
    this.frameRegistry = new FrameRegistry();
    // Message listener registry for managing message listeners
    this.messageListenerRegistry = new MessageListenerRegistry(this.frameRegistry);
    //
    this.callbackRegistry = new CallbackRegistry();
  }

  /**
   * Initialize the SDK and start monitoring URL changes
   */
  init() {
    if (this.initialized) return this;

    // Monitor URL changes
    setupUrlMonitoring(this);

    // Set up global listener if needed
    this.messageListenerRegistry.setupGlobalListener();

    // Listen for Escape key to close modal
    setupKeyListener();

    // Set up callback registry message listeners
    this._setupCallbackListeners();

    this.initialized = true;
    logger.info(`ShellUI SDK ${this.version} initialized`);
    return this;
  }

  /**
   * Sets up message listeners for callback triggers
   * Handles action/cancel clicks and cleanup messages
   * @private
   */
  _setupCallbackListeners() {
    // Listen for toast action clicks
    this.addMessageListener('SHELLUI_TOAST_ACTION', (data) => {
      const { id } = data.payload || {};
      if (id) {
        this.callbackRegistry.triggerAction(id);
      } else {
        logger.warn('SHELLUI_TOAST_ACTION message missing id');
      }
    });

    // Listen for toast cancel clicks
    this.addMessageListener('SHELLUI_TOAST_CANCEL', (data) => {
      const { id } = data.payload || {};
      if (id) {
        this.callbackRegistry.triggerCancel(id);
      } else {
        logger.warn('SHELLUI_TOAST_CANCEL message missing id');
      }
    });

    // Listen for toast cleanup (dismiss/autoclose)
    this.addMessageListener('SHELLUI_TOAST_CLEAR', (data) => {
      const { id } = data.payload || {};
      if (id) {
        this.callbackRegistry.clear(id);
      } else {
        logger.warn('SHELLUI_TOAST_CLEAR message missing id');
      }
    });
  }

  /**
   * Opens the settings modal with optional URL
   * @param {string} [url] - Optional URL or path to load in the modal iframe. Must be same domain or relative.
   * If inside an iframe, sends a message to the parent to open the modal
   * If not in an iframe, dispatches a custom event that can be handled by the app
   */
  openModal(url) {
    openModalAction(url);
  }

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
  toast(options) {
    return toastAction(options);
  }

  /**
   * Updates an existing toast notification by ID
   * @param {Object} options - Toast update options
   * @param {string} options.id - Toast ID (required)
   * @param {string} [options.title] - Updated toast title
   * @param {string} [options.description] - Updated toast description
   * @param {string} [options.type] - Updated toast type: 'default', 'success', 'error', 'warning', 'info', 'loading'
   * If inside an iframe, sends a message to the parent to update the toast
   * If not in an iframe, dispatches a custom event that can be handled by the app
   */
  toastUpdate(options) {
    if (!options || !options.id) {
      logger.warn('toastUpdate requires an id');
      return;
    }
    toastAction(options);
  }

  getVersion() {
    return this.version;
  }

  /**
   * Gets the UUID for an iframe by its window reference
   * @param {Window} windowRef - The window object from event.source (iframe's contentWindow)
   * @returns {string|undefined} The UUID assigned to the iframe, or undefined if not found
   */
  getUuidByIframe(windowRef) {
    return this.frameRegistry.getUuidByIframe(windowRef);
  }

  /**
   * Adds an iframe reference and assigns a generated UUID to it
   * @param {HTMLIFrameElement} iframe - The iframe element to register
   * @returns {string} The UUID assigned to the iframe
   */
  addIframe(iframe) {
    return this.frameRegistry.addIframe(iframe);
  }

  /**
   * Removes an iframe reference by UUID or iframe element
   * @param {string|HTMLIFrameElement} identifier - The UUID string or iframe element to remove
   * @returns {boolean} True if the iframe was found and removed, false otherwise
   */
  removeIframe(identifier) {
    return this.frameRegistry.removeIframe(identifier);
  }

  /**
   * Adds a listener for a specific ShellUI message type
   * @param {string} messageType - The message type to listen for (e.g., 'SHELLUI_OPEN_MODAL', 'SHELLUI_URL_CHANGED')
   * @param {Function} listener - The callback function to call when the message is received
   *                               Receives (messageData, originalEvent) as arguments
   * @returns {Function} A cleanup function to remove the listener (useful for useEffect)
   * @example
   * const cleanup = sdk.addMessageListener('SHELLUI_OPEN_MODAL', (data, event) => {
   *   console.log('Modal opened:', data.payload);
   * });
   * // Later, call cleanup() to remove the listener
   */
  addMessageListener(messageType, listener) {
    return this.messageListenerRegistry.addMessageListener(messageType, listener);
  }

  /**
   * Removes a listener for a specific message type
   * @param {string} messageType - The message type
   * @param {Function} listener - The listener function to remove
   * @returns {boolean} True if the listener was found and removed, false otherwise
   */
  removeMessageListener(messageType, listener) {
    return this.messageListenerRegistry.removeMessageListener(messageType, listener);
  }

  /**
   * Sends a message to specific iframes based on the 'to' array
   * @param {ShellUIMessage} message - The message to send
   * @returns {number} The number of iframes the message was sent to
   */
  sendMessage(message) {
    return this.messageListenerRegistry.sendMessage(message);
  }

  /**
   * Propagates a message to all registered iframes (convenience method)
   * @param {string} messageType - The message type
   * @param {Object} payload - The message payload
   * @returns {number} The number of iframes the message was sent to
   * @example
   * sdk.propagateMessage('SHELLUI_CUSTOM', { data: 'broadcast' });
   */
  propagateMessage(message) {
    return this.messageListenerRegistry.propagateMessage(message);
  }

  sendMessageToParent(message) {
    return this.messageListenerRegistry.sendMessageToParent(message);
  }
}

const sdk = new ShellUISDK();

export const init = () => sdk.init();
export const getVersion = () => sdk.getVersion();
export const openModal = (url) => openModalAction(url);
export const toast = (options) => toastAction(options);
export const toastUpdate = (options) => sdk.toastUpdate(options);
export const addIframe = (iframe) => sdk.addIframe(iframe);
export const removeIframe = (identifier) => sdk.removeIframe(identifier);
export const addMessageListener = (messageType, listener) => sdk.addMessageListener(messageType, listener);
export const removeMessageListener = (messageType, listener) => sdk.removeMessageListener(messageType, listener);
export const sendMessage = (message) => sdk.sendMessage(message);
export const propagateMessage = (message) => sdk.propagateMessage(message);
export const sendMessageToParent = (message) => sdk.sendMessageToParent(message);
export const callbackRegistry = sdk.callbackRegistry;
export { getLogger } from './logger/logger.js';
export const shellui = sdk;

export default sdk;
