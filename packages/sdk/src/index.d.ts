/**
 * ShellUI SDK Type Definitions
 */

export interface ShellUIUrlPayload {
  pathname: string;
  search: string;
  hash: string;
  fullPath: string;
}

export interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'default' | 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
}

export interface ShellUIMessage {
  type: 'SHELLUI_URL_CHANGED' | 'SHELLUI_OPEN_MODAL' | 'SHELLUI_CLOSE_MODAL' | 'SHELLUI_SETTINGS_UPDATED' | 'SHELLUI_TOAST';
  payload: ShellUIUrlPayload | Record<string, never> | { url?: string | null } | ToastOptions | { [key: string]: any };
  from?: string[];
  to?: string[];
}

export class ShellUISDK {
  private initialized: boolean;
  private currentPath: string;
  private version: string;
  private iframes: Map<string, HTMLIFrameElement>;

  constructor();

  /**
   * Initialize the SDK and start monitoring URL changes
   */
  init(): this;

  /**
   * Opens the settings modal with optional URL
   * @param url - Optional URL or path to load in the modal iframe. Must be same domain or relative.
   * If inside an iframe, sends a message to the parent to open the modal
   * If not in an iframe, dispatches a custom event that can be handled by the app
   */
  openModal(url?: string): void;

  /**
   * Shows a toast notification
   * @param options - Toast options
   * If inside an iframe, sends a message to the parent to show the toast
   * If not in an iframe, dispatches a custom event that can be handled by the app
   */
  toast(options?: ToastOptions): void;

  /**
   * Returns the current version of the SDK
   */
  getVersion(): string;

  /**
   * Adds an iframe reference and assigns a generated UUID to it
   * @param iframe - The iframe element to register
   * @returns The UUID assigned to the iframe
   */
  addIframe(iframe: HTMLIFrameElement): string;

  /**
   * Removes an iframe reference by UUID or iframe element
   * @param identifier - The UUID string or iframe element to remove
   * @returns True if the iframe was found and removed, false otherwise
   */
  removeIframe(identifier: string | HTMLIFrameElement): boolean;

  /**
   * Adds a listener for a specific ShellUI message type
   * @param messageType - The message type to listen for (e.g., 'SHELLUI_OPEN_MODAL', 'SHELLUI_URL_CHANGED')
   * @param listener - The callback function to call when the message is received
   *                   Receives (messageData, originalEvent) as arguments
   * @returns A cleanup function to remove the listener (useful for useEffect)
   */
  addMessageListener(
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
  ): () => void;

  /**
   * Removes a listener for a specific message type
   * @param messageType - The message type
   * @param listener - The listener function to remove
   * @returns True if the listener was found and removed, false otherwise
   */
  removeMessageListener(
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
  ): boolean;

  /**
   * Sends a message to specific iframes based on the 'to' array
   * @param messageType - The message type (e.g., 'SHELLUI_OPEN_MODAL', 'SHELLUI_URL_CHANGED')
   * @param payload - The message payload
   * @param to - Array of iframe UUIDs to send to. If contains '*', sends to all iframes
   * @returns The number of iframes the message was sent to
   */
  sendMessage(message: ShellUIMessage): number;

  /**
   * Propagates a message to all registered iframes (convenience method)
   * @param messageType - The message type
   * @param payload - The message payload
   * @returns The number of iframes the message was sent to
   */
  propagateMessage(message: ShellUIMessage): number;

  /**
   * Sends a message to the parent window (if in an iframe)
   * @param messageType - The message type
   * @param payload - The message payload
   * @returns True if the message was sent, false otherwise
   */
  sendMessageToParent(message: ShellUIMessage): boolean;
}

export const init: () => ShellUISDK;
export const getVersion: () => string;
export const openModal: (url?: string) => void;
export const toast: (options?: ToastOptions) => void;
export const addIframe: (iframe: HTMLIFrameElement) => string;
export const removeIframe: (identifier: string | HTMLIFrameElement) => boolean;
export const addMessageListener: (
  messageType: string,
  listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
) => () => void;
export const removeMessageListener: (
  messageType: string,
  listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
) => boolean;
export const sendMessage: (messageType: string, payload: any, to?: string[]) => number;
export const propagateMessage: (message: ShellUIMessage) => number;
export function getLogger(namespace: string): {
  log: (message: string, context?: Record<string, any>) => void;
  info: (message: string, context?: Record<string, any>) => void;
  warn: (message: string, context?: Record<string, any>) => void;
  error: (message: string, context?: Record<string, any>) => void;
  debug: (message: string, context?: Record<string, any>) => void;
};
export const shellui: ShellUISDK;

declare const sdk: ShellUISDK;
export default sdk;
