/**
 * ShellUI SDK
 * Handles communication between the iframe content and the ShellUI parent frame.
 */

import { setupUrlMonitoring } from './utils/setupUrlMonitoring';
import { setupKeyListener } from './utils/setupKeyListener';
import { openModal as openModalAction } from './actions/openModal';
import { openDrawer as openDrawerAction } from './actions/openDrawer';
import { closeDrawer as closeDrawerAction } from './actions/closeDrawer';
import { toast as toastAction } from './actions/toast';
import { dialog as dialogAction } from './actions/dialog';
import { getLogger } from './logger/logger';
import { FrameRegistry } from './utils/frameRegistry';
import { MessageListenerRegistry } from './utils/messageListenerRegistry';
import { CallbackRegistry } from './utils/callbackRegistry';
import type {
  ShellUIMessage,
  ToastOptions,
  DialogOptions,
  Settings,
  DrawerPosition,
} from './types';

import packageJson from '../package.json';

const logger = getLogger('shellsdk');

export type { ShellUIMessage, ShellUIUrlPayload, ToastOptions, DialogOptions, DialogMode, AlertDialogSize, DrawerPosition, LoggerInstance, Settings } from './types';

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
      payload: {}
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
        payload: {}
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
  }

  openModal(url?: string): void {
    openModalAction(url);
  }

  openDrawer(url?: string, position?: DrawerPosition): void {
    openDrawerAction(url, position);
  }

  closeDrawer(): void {
    closeDrawerAction();
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
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
  ): () => void {
    return this.messageListenerRegistry.addMessageListener(
      messageType,
      listener
    );
  }

  removeMessageListener(
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
  ): boolean {
    return this.messageListenerRegistry.removeMessageListener(
      messageType,
      listener
    );
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

export const init = async (): Promise<ShellUISDK> => await sdk.init();
export const getVersion = (): string => sdk.getVersion();
export const openModal = (url?: string): void => openModalAction(url);
export const openDrawer = (url?: string, position?: DrawerPosition): void =>
  openDrawerAction(url, position);
export const closeDrawer = (): void => closeDrawerAction();
export const toast = (options?: ToastOptions): string | void =>
  toastAction(options);
export const dialog = (options?: DialogOptions): string | void =>
  dialogAction(options);
export const addIframe = (iframe: HTMLIFrameElement): string =>
  sdk.addIframe(iframe);
export const removeIframe = (
  identifier: string | HTMLIFrameElement
): boolean => sdk.removeIframe(identifier);
export const addMessageListener = (
  messageType: string,
  listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
): (() => void) => sdk.addMessageListener(messageType, listener);
export const removeMessageListener = (
  messageType: string,
  listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void
): boolean => sdk.removeMessageListener(messageType, listener);
export const sendMessage = (message: ShellUIMessage): number =>
  sdk.sendMessage(message);
export const propagateMessage = (message: ShellUIMessage): number =>
  sdk.propagateMessage(message);
export const sendMessageToParent = (message: ShellUIMessage): boolean =>
  sdk.sendMessageToParent(message);
export const callbackRegistry = sdk.callbackRegistry;
export { getLogger } from './logger/logger.js';
export const shellui = sdk;

export default sdk;
