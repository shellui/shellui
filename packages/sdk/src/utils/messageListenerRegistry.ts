/**
 * Message Listener Registry
 * Manages message listeners for ShellUI message types
 */

import { getLogger } from '../logger/logger.js';
import type { ShellUIMessage } from '../types.js';
import type { FrameRegistry } from './frameRegistry.js';

const logger = getLogger('shellsdk');

export type MessageListener = (
  messageData: ShellUIMessage,
  originalEvent: MessageEvent
) => void;

export class MessageListenerRegistry {
  private listeners = new Map<string, Set<MessageListener>>();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private isListening = false;
  private frameRegistry: FrameRegistry | null;

  constructor(frameRegistry: FrameRegistry | null = null) {
    this.frameRegistry = frameRegistry;
  }

  setupGlobalListener(): void {
    if (typeof window === 'undefined' || this.isListening) {
      return;
    }

    this.messageHandler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object' || !event.data.type) {
        return;
      }

      const messageType = event.data.type as string;

      if (!messageType.startsWith('SHELLUI_')) {
        return;
      }

      const fromUuid = this.frameRegistry?.getUuidByIframe(
        event.source as Window
      );

      const typeListeners = this.listeners.get(messageType) ?? [];

      typeListeners.forEach((listener) => {
        try {
          if (
            window.parent === window ||
            (event.data.to &&
              (event.data.to.length === 0 || event.data.to.includes('*'))) ||
            messageType === 'SHELLUI_URL_CHANGED'
          ) {
            listener(
              {
                ...event.data,
                from: [fromUuid, ...(event.data.from || [])].filter(
                  Boolean
                ) as string[],
              },
              event
            );
          }
        } catch (error) {
          logger.error(`Error in message listener for ${messageType}:`, {
            error,
          });
        }
      });

      logger.debug('Message received:', event.data);

      if (messageType === 'SHELLUI_URL_CHANGED') {
        return;
      }

      if (fromUuid) {
        this.sendMessageToParent({
          type: messageType,
          payload: event.data.payload,
          from: [fromUuid, ...(event.data.from || [])],
        });
      }

      const fromParent = event.source === window.parent;
      if (fromParent) {
        this.sendMessage({
          type: messageType,
          payload: event.data.payload,
          to: [...(event.data.to || [])],
        });
      }
    };

    window.addEventListener('message', this.messageHandler);
    this.isListening = true;
    logger.debug('Global message listener set up');
  }

  teardownGlobalListener(): void {
    if (!this.isListening || !this.messageHandler) {
      return;
    }

    window.removeEventListener('message', this.messageHandler);
    this.isListening = false;
    this.messageHandler = null;
    logger.debug('Global message listener torn down');
  }

  addMessageListener(
    messageType: string,
    listener: MessageListener
  ): () => void {
    if (typeof messageType !== 'string' || !messageType.startsWith('SHELLUI_')) {
      throw new Error('messageType must be a string starting with "SHELLUI_"');
    }

    if (typeof listener !== 'function') {
      throw new Error('listener must be a function');
    }

    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set());
    }

    const typeListeners = this.listeners.get(messageType)!;
    typeListeners.add(listener);

    logger.debug(`Added listener for message type: ${messageType}`);

    return () => {
      this.removeMessageListener(messageType, listener);
    };
  }

  removeMessageListener(
    messageType: string,
    listener: MessageListener
  ): boolean {
    if (typeof messageType !== 'string' || !messageType.startsWith('SHELLUI_')) {
      throw new Error('messageType must be a string starting with "SHELLUI_"');
    }

    const typeListeners = this.listeners.get(messageType);
    if (!typeListeners) {
      return false;
    }

    const removed = typeListeners.delete(listener);

    if (typeListeners.size === 0) {
      this.listeners.delete(messageType);
    }

    if (removed) {
      logger.debug(`Removed listener for message type: ${messageType}`);
    }

    return removed;
  }

  getListenerCount(messageType: string): number {
    const typeListeners = this.listeners.get(messageType);
    return typeListeners ? typeListeners.size : 0;
  }

  removeAllListeners(messageType: string): number {
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

  removeAllListenersForAllTypes(): void {
    const totalCount = Array.from(this.listeners.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );
    this.listeners.clear();
    logger.debug(
      `Removed all ${totalCount} listeners for all message types`
    );
  }

  sendMessage(message: ShellUIMessage): number {
    if (typeof window === 'undefined') {
      logger.warn('Cannot send message: window is undefined');
      return 0;
    }

    if (!this.frameRegistry) {
      logger.warn('Cannot send message: frameRegistry not available');
      return 0;
    }

    if (
      typeof message.type !== 'string' ||
      !message.type.startsWith('SHELLUI_')
    ) {
      throw new Error('messageType must be a string starting with "SHELLUI_"');
    }

    const sendToAll = message.to?.includes('*');
    const allIframes = this.frameRegistry.getAllIframes();

    if (allIframes.length === 0) {
      logger.debug(`No iframes registered, message ${message.type} not sent`);
      return 0;
    }

    let sentCount = 0;

    for (const [uuid, iframe] of allIframes) {
      if (sendToAll || message.to?.includes(uuid)) {
        try {
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              {
                type: message.type,
                payload: message.payload,
                to: (message.to || []).filter((t) => t !== uuid),
              },
              '*'
            );
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

  propagateMessage(message: ShellUIMessage): number {
    return this.sendMessage({
      type: message.type,
      payload: message.payload,
      to: ['*'],
    });
  }

  sendMessageToParent(message: ShellUIMessage): boolean {
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
