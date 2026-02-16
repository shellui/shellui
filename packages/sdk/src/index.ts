/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

import { setupUrlMonitoring } from './utils/setupUrlMonitoring.js';
import { setupKeyListener } from './utils/setupKeyListener.js';
import { openModal as openModalAction } from './actions/openModal.js';
import { openDrawer as openDrawerAction } from './actions/openDrawer.js';
import { closeDrawer as closeDrawerAction } from './actions/closeDrawer.js';
import { toast as toastAction } from './actions/toast.js';
import { dialog as dialogAction } from './actions/dialog.js';
import { getLogger } from './logger/logger.js';
import { FrameRegistry } from './utils/frameRegistry.js';
import { MessageListenerRegistry } from './utils/messageListenerRegistry.js';
import { CallbackRegistry } from './utils/callbackRegistry.js';
import type {
  ShellUIMessage,
  ToastOptions,
  DialogOptions,
  Settings,
  OpenDrawerOptions,
} from './types.js';

import packageJson from '../package.json';

const logger = getLogger('shellsdk');

export type {
  ShellUIMessage,
  ShellUIUrlPayload,
  ToastOptions,
  DialogOptions,
  DialogMode,
  AlertDialogSize,
  DialogPosition,
  DrawerPosition,
  OpenDrawerOptions,
  LoggerInstance,
  Settings,
  SettingsNavigationItem,
  ThemeColorsMode,
  ThemeColors,
  SettingsTheme,
  SettingsAvailableTheme,
  Appearance,
} from './types.js';

export class ShellUISDK {
  initialized = false;
  currentPath: string;
  version: string;
  frameRegistry: FrameRegistry;
  messageListenerRegistry: MessageListenerRegistry;
  callbackRegistry: CallbackRegistry;
  initialSettings: Settings | null;

  constructor() {
    this.currentPath =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search + window.location.hash
        : '';
    this.version = (packageJson as { version: string }).version;
    this.frameRegistry = new FrameRegistry();
    this.messageListenerRegistry = new MessageListenerRegistry(this.frameRegistry);
    this.callbackRegistry = new CallbackRegistry();
    this.initialSettings = null;
  }

  async init(): Promise<this> {
    if (this.initialized) return this;

    await setupUrlMonitoring(this);
    await this.messageListenerRegistry.setupGlobalListener();
    await setupKeyListener();
    await this._setupCallbackListeners();
    await this._setupInitialSettings();

    this.initialized = true;
    logger.info(`ShellUI SDK ${this.version} initialized`);

    this.sendMessageToParent({
      type: 'SHELLUI_INITIALIZED',
      payload: {},
    });
    return Promise.resolve(this);
  }

  private async _setupInitialSettings(): Promise<void> {
    if (window.parent === window) {
      return;
    }
    return new Promise((resolve) => {
      const cleanup = this.addMessageListener('SHELLUI_SETTINGS', (data) => {
        const { settings } = data.payload as { settings: Settings };
        this.initialSettings = settings;
        resolve();
        cleanup();
      });
      this.sendMessageToParent({
        type: 'SHELLUI_SETTINGS_REQUESTED',
        payload: {},
      });
    });
  }

  private _setupCallbackListeners(): void {
    this.addMessageListener('SHELLUI_TOAST_ACTION', (data) => {
      const { id } = (data.payload as { id?: string }) ?? {};
      if (id) {
        this.callbackRegistry.triggerAction(id);
        this.callbackRegistry.clear(id);
      } else {
        logger.warn('SHELLUI_TOAST_ACTION message missing id');
      }
    });

    this.addMessageListener('SHELLUI_TOAST_CANCEL', (data) => {
      const { id } = (data.payload as { id?: string }) ?? {};
      if (id) {
        this.callbackRegistry.triggerCancel(id);
        this.callbackRegistry.clear(id);
      } else {
        logger.warn('SHELLUI_TOAST_CANCEL message missing id');
      }
    });

    this.addMessageListener('SHELLUI_TOAST_CLEAR', (data) => {
      const { id } = (data.payload as { id?: string }) ?? {};
      if (id) {
        this.callbackRegistry.clear(id);
      } else {
        logger.warn('SHELLUI_TOAST_CLEAR message missing id');
      }
    });

    this.addMessageListener('SHELLUI_DIALOG_OK', (data) => {
      const { id } = (data.payload as { id?: string }) ?? {};
      if (id) {
        this.callbackRegistry.triggerAction(id);
        this.callbackRegistry.clear(id);
      } else {
        logger.warn('SHELLUI_DIALOG_OK message missing id');
      }
    });

    this.addMessageListener('SHELLUI_DIALOG_CANCEL', (data) => {
      const { id } = (data.payload as { id?: string }) ?? {};
      if (id) {
        this.callbackRegistry.triggerCancel(id);
        this.callbackRegistry.clear(id);
      } else {
        logger.warn('SHELLUI_DIALOG_CANCEL message missing id');
      }
    });

    this.addMessageListener('SHELLUI_DIALOG_SECONDARY', (data) => {
      const { id } = (data.payload as { id?: string }) ?? {};
      if (id) {
        this.callbackRegistry.triggerSecondary(id);
        this.callbackRegistry.clear(id);
      } else {
        logger.warn('SHELLUI_DIALOG_SECONDARY message missing id');
      }
    });

    this.addMessageListener('SHELLUI_REFRESH_PAGE', () => {
      if (typeof window !== 'undefined' && window.parent === window) {
        window.location.reload();
      }
    });
  }

  openModal(url?: string): void {
    openModalAction(url);
  }

  openDrawer(options?: OpenDrawerOptions): void {
    openDrawerAction(options);
  }

  closeDrawer(): void {
    closeDrawerAction();
  }

  navigate(url: string): void {
    this.sendMessageToParent({
      type: 'SHELLUI_NAVIGATE',
      payload: { url },
    });
  }

  toast(options?: ToastOptions): string | void {
    return toastAction(options);
  }

  dialog(options?: DialogOptions): string | void {
    return dialogAction(options);
  }

  getVersion(): string {
    return this.version;
  }

  getUuidByIframe(windowRef: Window): string | undefined {
    return this.frameRegistry.getUuidByIframe(windowRef);
  }

  addIframe(iframe: HTMLIFrameElement): string {
    return this.frameRegistry.addIframe(iframe);
  }

  removeIframe(identifier: string | HTMLIFrameElement): boolean {
    return this.frameRegistry.removeIframe(identifier);
  }

  addMessageListener(
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void,
  ): () => void {
    return this.messageListenerRegistry.addMessageListener(messageType, listener);
  }

  removeMessageListener(
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void,
  ): boolean {
    return this.messageListenerRegistry.removeMessageListener(messageType, listener);
  }

  sendMessage(message: ShellUIMessage): number {
    return this.messageListenerRegistry.sendMessage(message);
  }

  propagateMessage(message: ShellUIMessage): number {
    return this.messageListenerRegistry.propagateMessage(message);
  }

  sendMessageToParent(message: ShellUIMessage): boolean {
    return this.messageListenerRegistry.sendMessageToParent(message);
  }
}

const sdk = new ShellUISDK();

export interface ShellUIInitOptions {
  /** When false, the iframe does not sync its URL to the parent (no SHELLUI_URL_CHANGED). Default true. Set to false so browser back only sees shell-level navigations. */
  syncUrlWithParent?: boolean;
}

export const init = async (options?: ShellUIInitOptions): Promise<ShellUISDK> =>
  await sdk.init(options);
export const getVersion = (): string => sdk.getVersion();
export const openModal = (url?: string): void => openModalAction(url);
export const openDrawer = (options?: OpenDrawerOptions): void => openDrawerAction(options);
export const closeDrawer = (): void => closeDrawerAction();
export const navigate = (url: string): void => sdk.navigate(url);
export const toast = (options?: ToastOptions): string | void => toastAction(options);
export const dialog = (options?: DialogOptions): string | void => dialogAction(options);
export const addIframe = (iframe: HTMLIFrameElement): string => sdk.addIframe(iframe);
export const removeIframe = (identifier: string | HTMLIFrameElement): boolean =>
  sdk.removeIframe(identifier);
export const addMessageListener = (
  messageType: string,
  listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void,
): (() => void) => sdk.addMessageListener(messageType, listener);
export const removeMessageListener = (
  messageType: string,
  listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void,
): boolean => sdk.removeMessageListener(messageType, listener);
export const sendMessage = (message: ShellUIMessage): number => sdk.sendMessage(message);
export const propagateMessage = (message: ShellUIMessage): number => sdk.propagateMessage(message);
export const sendMessageToParent = (message: ShellUIMessage): boolean =>
  sdk.sendMessageToParent(message);
export const callbackRegistry = sdk.callbackRegistry;
export { getLogger } from './logger/logger.js';
export const shellui = sdk;

export default sdk;
