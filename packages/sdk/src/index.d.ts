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
  type: 'SHELLUI_URL_CHANGED';
  payload: ShellUIUrlPayload;
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
   * Sets up listeners for various URL change events
   */
  setupUrlMonitoring(): void;

  /**
   * Internal handler for URL changes
   */
  handleUrlChange(): void;

  /**
   * Sends a message to the parent frame with the current path information
   */
  notifyParent(): void;

  /**
   * Returns the current version of the SDK
   */
  getVersion(): string;
}

export const init: () => ShellUISDK;
export const getVersion: () => string;
export const shellui: ShellUISDK;

declare const sdk: ShellUISDK;
export default sdk;
