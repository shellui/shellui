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
  id?: string;
  title?: string;
  description?: string;
  type?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';
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

export type DialogMode = 'ok' | 'okCancel' | 'delete' | 'confirm' | 'onlyCancel';

export interface DialogOptions {
  id?: string;
  title: string;
  description?: string;
  mode?: DialogMode;
  okLabel?: string;
  cancelLabel?: string;
  onOk?: () => void;
  onCancel?: () => void;
}


export interface Settings {
  developerFeatures: {
    enabled: boolean
  }
  logging: {
    namespaces: {
      shellsdk: boolean
      shellcore: boolean
    }
  }
  appearance: {
    theme: 'light' | 'dark' | 'system'
    themeName: string
  }
  language: {
    code: 'en' | 'fr'
  }
  region: {
    timezone: string
  }
  // Add more settings here as needed
  // notifications: { ... }
}


export type ShellUIMessageType =
  | 'SHELLUI_URL_CHANGED'
  | 'SHELLUI_OPEN_MODAL'
  | 'SHELLUI_CLOSE_MODAL'
  | 'SHELLUI_SETTINGS_UPDATED'
  | 'SHELLUI_SETTINGS'
  | 'SHELLUI_SETTINGS_REQUESTED'
  | 'SHELLUI_TOAST'
  | 'SHELLUI_TOAST_UPDATE'
  | 'SHELLUI_TOAST_ACTION'
  | 'SHELLUI_TOAST_CANCEL'
  | 'SHELLUI_TOAST_CLEAR'
  | 'SHELLUI_DIALOG'
  | 'SHELLUI_DIALOG_UPDATE'
  | 'SHELLUI_DIALOG_OK'
  | 'SHELLUI_DIALOG_CANCEL';

export interface ShellUIMessage {
  type: ShellUIMessageType | string;
  payload:
    | ShellUIUrlPayload
    | Record<string, never>
    | { url?: string | null }
    | ToastOptions
    | DialogOptions
    | { [key: string]: unknown };
  from?: string[];
  to?: string[];
}

export interface LoggerInstance {
  log: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}
