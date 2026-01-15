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
}

export const init: () => ShellUISDK;
export const getVersion: () => string;
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
