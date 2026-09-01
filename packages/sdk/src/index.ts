/**
 * Shellui SDK
 * Handles communication between the iframe content and the Shellui parent frame.
 */

import { setupUrlMonitoring } from './utils/setupUrlMonitoring.js';
import { setupKeyListener } from './utils/setupKeyListener.js';
import { openModal as openModalAction } from './actions/openModal.js';
import { closeModal as closeModalAction } from './actions/closeModal.js';
import { openDrawer as openDrawerAction } from './actions/openDrawer.js';
import { closeDrawer as closeDrawerAction } from './actions/closeDrawer.js';
import { reportSize as overlayReportSize, autoSize as overlayAutoSize } from './actions/overlay.js';
import { login as loginAction } from './actions/login.js';
import { toast as toastAction } from './actions/toast.js';
import { dialog as dialogAction } from './actions/dialog.js';
import {
  selectStorage as selectStorageAction,
  selectFolders as selectFoldersAction,
  selectFiles as selectFilesAction,
} from './actions/selectStorage.js';
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
  OpenModalOptions,
  OverlayAutoSizeOptions,
  OverlayReportSizeOptions,
  LoginOptions,
  StorageSelectOptions,
  StorageSelectResult,
} from './types.js';
import { StorageClient } from './storage/client.js';
import { createPostMessageTransport } from './storage/transport.js';

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
  OverlaySizePreset,
  OverlaySizeValue,
  OverlayOpenOptions,
  OpenModalOptions,
  OpenDrawerOptions,
  OverlayReportSizeOptions,
  OverlayAutoSizeOptions,
  OverlaySizePayload,
  LoginOptions,
  StorageSelectOptions,
  StorageSelectResult,
  StorageSelectedItem,
  StorageSelectMode,
  StorageSelectRequestPayload,
  StorageSelectResponsePayload,
  LoggerInstance,
  Settings,
  SettingsUser,
  SettingsNavigationItem,
  SettingsAdministration,
  SettingsAdministrationNavigationItem,
  SettingsStorage,
  ThemeColorsMode,
  ThemeColors,
  SettingsTheme,
  SettingsAvailableTheme,
  Appearance,
} from './types.js';

/** Iframe helpers for content-sized modal/drawer overlays. */
export const overlay = {
  reportSize: (options: OverlayReportSizeOptions): void => overlayReportSize(options),
  autoSize: (options?: OverlayAutoSizeOptions): (() => void) => overlayAutoSize(options),
};

export { StorageError } from './storage/types.js';
export type {
  StorageResponse,
  StorageListOptions,
  StorageUploadOptions,
  StorageMoveOptions,
  StorageBucket,
  StorageFileObject,
  StorageFolderStats,
  StorageFolderMoveResult,
  StorageObjectAccess,
  StorageRequestPayload,
  StorageRequestInput,
  StorageResponsePayload,
  StorageErrorPayload,
  StorageOp,
  StorageResolvedItem,
} from './storage/types.js';
export { StorageClient, StorageBucketApi } from './storage/client.js';

export class ShellUISDK {
  initialized = false;
  currentPath: string;
  version: string;
  frameRegistry: FrameRegistry;
  messageListenerRegistry: MessageListenerRegistry;
  callbackRegistry: CallbackRegistry;
  initialSettings: Settings | null;
  storage: StorageClient;

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
    this.storage = new StorageClient(createPostMessageTransport(this));
  }

  async init(): Promise<this> {
    if (this.initialized) return this;

    await setupUrlMonitoring(this);
    await this.messageListenerRegistry.setupGlobalListener();
    await setupKeyListener();
    await this._setupCallbackListeners();
    await this._setupInitialSettings();

    this.initialized = true;
    logger.info(`Shellui SDK ${this.version} initialized`);

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

    const applySettings = (data: ShellUIMessage) => {
      const settings = (data.payload as { settings?: Settings } | undefined)?.settings;
      if (settings) {
        this.initialSettings = settings;
      }
    };

    // Keep `initialSettings` fresh across token refresh / preference pushes so late
    // readers (nested iframes, hooks mounting after a refresh) do not reuse a stale JWT.
    this.addMessageListener('SHELLUI_SETTINGS', applySettings);
    this.addMessageListener('SHELLUI_SETTINGS_UPDATED', applySettings);

    return new Promise((resolve) => {
      const cleanup = this.addMessageListener('SHELLUI_SETTINGS', () => {
        cleanup();
        resolve();
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

  /** Iframe helpers for content-sized modal/drawer overlays. */
  overlay = {
    reportSize: (options: OverlayReportSizeOptions): void => overlayReportSize(options),
    autoSize: (options?: OverlayAutoSizeOptions): (() => void) => overlayAutoSize(options),
  };

  openModal(urlOrOptions?: string | OpenModalOptions): void {
    openModalAction(urlOrOptions);
  }

  closeModal(): void {
    closeModalAction();
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

  login(options: LoginOptions): void {
    loginAction(options);
  }

  toast(options?: ToastOptions): string | void {
    return toastAction(options);
  }

  dialog(options?: DialogOptions): string | void {
    return dialogAction(options);
  }

  selectStorage(options?: StorageSelectOptions): Promise<StorageSelectResult | null> {
    return selectStorageAction(options);
  }

  selectFolders(options?: { multiple?: boolean }): Promise<StorageSelectResult | null> {
    return selectFoldersAction(options);
  }

  selectFiles(options?: {
    multiple?: boolean;
    folders?: boolean;
  }): Promise<StorageSelectResult | null> {
    return selectFilesAction(options);
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

export const init = async (): Promise<ShellUISDK> => await sdk.init();
export const getVersion = (): string => sdk.getVersion();
export const openModal = (urlOrOptions?: string | OpenModalOptions): void =>
  openModalAction(urlOrOptions);
export const closeModal = (): void => closeModalAction();
export const openDrawer = (options?: OpenDrawerOptions): void => openDrawerAction(options);
export const closeDrawer = (): void => closeDrawerAction();
export const navigate = (url: string): void => sdk.navigate(url);
export const login = (options: LoginOptions): void => sdk.login(options);
export const toast = (options?: ToastOptions): string | void => toastAction(options);
export const dialog = (options?: DialogOptions): string | void => dialogAction(options);
export const selectStorage = (
  options?: StorageSelectOptions,
): Promise<StorageSelectResult | null> => selectStorageAction(options);
export const selectFolders = (options?: {
  multiple?: boolean;
}): Promise<StorageSelectResult | null> => selectFoldersAction(options);
export const selectFiles = (options?: {
  multiple?: boolean;
  folders?: boolean;
}): Promise<StorageSelectResult | null> => selectFilesAction(options);
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
export const storage = sdk.storage;

export default sdk;
