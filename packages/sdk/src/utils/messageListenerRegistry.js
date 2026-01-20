/**
 * Message Listener Registry
 * Manages message listeners for ShellUI message types
 */

import { getLogger } from '../logger/logger.js';

const logger = getLogger('shellsdk');

/**
 * MessageListenerRegistry class for managing message listeners
 */
export class MessageListenerRegistry {
  constructor(frameRegistry = null) {
    // Map to store listeners by message type
    // Key: message type (e.g., 'SHELLUI_OPEN_MODAL')
    // Value: Set of listener functions
    this.listeners = new Map();
    this.messageHandler = null;
    this.isListening = false;
    // Reference to frame registry for sending messages to iframes
    this.frameRegistry = frameRegistry;
  }

  /**
   * Sets up the global message listener if not already set up
   */
  setupGlobalListener() {
    if (typeof window === 'undefined' || this.isListening) {
      return;
    }

    this.messageHandler = (event) => {
      // Only handle ShellUI messages
      if (!event.data || typeof event.data !== 'object' || !event.data.type) {
        return;
      }

      const messageType = event.data.type;

      // Check if this is a ShellUI message
      if (!messageType.startsWith('SHELLUI_')) {
        return;
      }

      // Get all listeners for this message type
      const typeListeners = this.listeners.get(messageType) ?? [];

      // Call all registered listeners
      typeListeners.forEach((listener) => {
        try {
          // Trigger listener if root node or event data to is empty array or contains *
          if (window.parent === window || (event.data.to && (event.data.to.length === 0 || event.data.to.includes('*'))) || messageType === 'SHELLUI_URL_CHANGED') {
            listener(event.data, event);
          }
        } catch (error) {
          logger.error(`Error in message listener for ${messageType}:`, { error });
        }
      });

      logger.debug('Message received:', event.data);
      // We ignore propagation of SHELLUI_URL_CHANGED messages to parent
      if (messageType === 'SHELLUI_URL_CHANGED') {
        return;
      }

      // If message from children, propagate to parent
      const fromUuid = this.frameRegistry.getUuidByIframe(event.source);
      if (fromUuid) {
        this.sendMessageToParent({
          type: messageType,
          payload: event.data.payload,
          from: [fromUuid, ...(event.data.from || [])]
        });
      }

      // If message is from parent
      const fromParent = event.source === window.parent;
      if (fromParent) {
        this.sendMessage({
          type: messageType,
          payload: event.data.payload,
          to: [...(event.data.to || [])]
        });
      }
    };

    window.addEventListener('message', this.messageHandler);
    this.isListening = true;
    logger.debug('Global message listener set up');
  }

  /**
   * Tears down the global message listener
   */
  teardownGlobalListener() {
    if (!this.isListening || !this.messageHandler) {
      return;
    }

    window.removeEventListener('message', this.messageHandler);
    this.isListening = false;
    this.messageHandler = null;
    logger.debug('Global message listener torn down');
  }

  /**
   * Adds a listener for a specific message type
   * @param {string} messageType - The message type to listen for (e.g., 'SHELLUI_OPEN_MODAL')
   * @param {Function} listener - The callback function to call when the message is received
   * @returns {Function} A cleanup function to remove the listener
   */
  addMessageListener(messageType, listener) {
    if (typeof messageType !== 'string' || !messageType.startsWith('SHELLUI_')) {
      throw new Error('messageType must be a string starting with "SHELLUI_"');
    }

    if (typeof listener !== 'function') {
      throw new Error('listener must be a function');
    }

    // Ensure we have a Set for this message type
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set());
    }

    const typeListeners = this.listeners.get(messageType);
    typeListeners.add(listener);

    logger.debug(`Added listener for message type: ${messageType}`);

    // Return cleanup function
    return () => {
      this.removeMessageListener(messageType, listener);
    };
  }

  /**
   * Removes a listener for a specific message type
   * @param {string} messageType - The message type
   * @param {Function} listener - The listener function to remove
   * @returns {boolean} True if the listener was found and removed, false otherwise
   */
  removeMessageListener(messageType, listener) {
    if (typeof messageType !== 'string' || !messageType.startsWith('SHELLUI_')) {
      throw new Error('messageType must be a string starting with "SHELLUI_"');
    }

    const typeListeners = this.listeners.get(messageType);
    if (!typeListeners) {
      return false;
    }

    const removed = typeListeners.delete(listener);

    // Clean up empty Sets
    if (typeListeners.size === 0) {
      this.listeners.delete(messageType);
    }

    // If no listeners remain, we could tear down the global listener
    // But we keep it active in case listeners are added again
    // The overhead is minimal and it's simpler

    if (removed) {
      logger.debug(`Removed listener for message type: ${messageType}`);
    }

    return removed;
  }

  /**
   * Gets the number of listeners for a specific message type
   * @param {string} messageType - The message type
   * @returns {number} The number of listeners for this message type
   */
  getListenerCount(messageType) {
    const typeListeners = this.listeners.get(messageType);
    return typeListeners ? typeListeners.size : 0;
  }

  /**
   * Removes all listeners for a specific message type
   * @param {string} messageType - The message type
   * @returns {number} The number of listeners removed
   */
  removeAllListeners(messageType) {
    if (typeof messageType !== 'string' || !messageType.startsWith('SHELLUI_')) {
      throw new Error('messageType must be a string starting with "SHELLUI_"');
    }

    const typeListeners = this.listeners.get(messageType);
    if (!typeListeners) {
      return 0;
    }

    const count = typeListeners.size;
    this.listeners.delete(messageType);
    logger.debug(`Removed all ${count} listeners for message type: ${messageType}`);
    return count;
  }

  /**
   * Removes all listeners for all message types
   */
  removeAllListenersForAllTypes() {
    const totalCount = Array.from(this.listeners.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );
    this.listeners.clear();
    logger.debug(`Removed all ${totalCount} listeners for all message types`);
  }

  /**
   * Sends a message to specific iframes based on the 'to' array
   * @param {string} messageType - The message type (e.g., 'SHELLUI_OPEN_MODAL')
   * @param {Object} payload - The message payload
   * @param {string[]} to - Array of iframe UUIDs to send to. If contains '*', sends to all iframes
   * @returns {number} The number of iframes the message was sent to
   */
  sendMessage(message) {
    if (typeof window === 'undefined') {
      logger.warn('Cannot send message: window is undefined');
      return 0;
    }

    if (!this.frameRegistry) {
      logger.warn('Cannot send message: frameRegistry not available');
      return 0;
    }

    if (typeof message.type !== 'string' || !message.type.startsWith('SHELLUI_')) {
      throw new Error('messageType must be a string starting with "SHELLUI_"');
    }

    // Check if we should send to all iframes (if '*' is in the 'to' array)
    const sendToAll = message.to?.includes('*');

    // Get all registered iframes
    const allIframes = this.frameRegistry.getAllIframes();

    if (allIframes.length === 0) {
      logger.debug(`No iframes registered, message ${message.type} not sent`);
      return 0;
    }

    let sentCount = 0;

    // Send to all iframes if '*' is in 'to', otherwise filter by UUID
    for (const [uuid, iframe] of allIframes) {
      if (sendToAll || message.to?.includes(uuid)) {
        try {
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: message.type,
              payload: message.payload,
              to: (message.to || []).filter(t => t !== uuid)
            }, '*');
            sentCount++;
            logger.debug(`Sent message ${message.type} to iframe ${uuid}`);
          } else {
            logger.warn(`Iframe ${uuid} has no contentWindow, skipping`);
          }
        } catch (error) {
          logger.error(`Error sending message to iframe ${uuid}:`, { error });
        }
      }
    }

    logger.debug(`Sent message ${message.type} to ${sentCount} iframe(s)`);
    return sentCount;
  }

  /**
   * Propagates a message to all registered iframes. This is a convenience method
   * to broadcast a ShellUI message to every iframe managed by the frame registry.
   * 
   * @param {Object} message - The ShellUI message to propagate.
   * @param {string} message.type - The ShellUI message type (e.g., 'SHELLUI_OPEN_MODAL').
   * @param {Object} [message.payload] - The message payload (optional).
   * @returns {number} The number of iframes the message was sent to.
   */
  propagateMessage(message) {
    return this.sendMessage({
      type: message.type,
      payload: message.payload,
      to: ['*']
    });
  }

  /**
   * Sends a message to the parent window (if in an iframe)
   * @param {string} messageType - The message type
   * @param {Object} payload - The message payload
   * @returns {boolean} True if the message was sent, false otherwise
   */
  sendMessageToParent(message) {
    if (typeof window === 'undefined') {
      logger.warn('Cannot send message to parent: window is undefined');
      return false;
    }

    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
      logger.debug(`Sent message ${message.type} to parent window`);
      return true;
    }
    return false;
  }
}
