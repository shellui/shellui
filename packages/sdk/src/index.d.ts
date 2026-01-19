/**
 * ShellUI SDK Type Definitions
 */

export interface ShellUIUrlPayload {
  pathname: string;
  search: string;
  hash: string;
  fullPath: string;
}

export interface ShellUIMessage {
  type: 'SHELLUI_URL_CHANGED' | 'SHELLUI_OPEN_MODAL';
  payload: ShellUIUrlPayload | Record<string, never>;
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
}

export const init: () => ShellUISDK;
export const getVersion: () => string;
export const addIframe: (iframe: HTMLIFrameElement) => string;
export const removeIframe: (identifier: string | HTMLIFrameElement) => boolean;
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
