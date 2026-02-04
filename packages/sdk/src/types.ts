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

export type AlertDialogSize = 'default' | 'sm';

export type DialogPosition = 'center' | 'bottom-left';

export interface DialogOptions {
  id?: string;
  title: string;
  description?: string;
  mode?: DialogMode;
  okLabel?: string;
  cancelLabel?: string;
  size?: AlertDialogSize;
  position?: DialogPosition;
  secondaryButton?: {
    label: string;
    onClick: () => void;
  };
  icon?: string; // Icon identifier (e.g., 'cookie') - React nodes cannot be serialized
  onOk?: () => void;
  onCancel?: () => void;
}


/** Navigation item exposed to sub-apps (root-level nav config) */
export interface SettingsNavigationItem {
  path: string
  url: string
  label?: string
}

export interface Settings {
  developerFeatures: {
    enabled: boolean
  }
  /** User toggle for sending error reports (only relevant when app has reporting configured). */
  errorReporting: {
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
  /**
   * Cookie consent: hosts the user has accepted. Only enable a feature when its cookie host is in acceptedHosts.
   * consentedCookieHosts = list of hosts that were in config when user last gave consent; if config has a host
   * not in this list, re-prompt and pre-fill with acceptedHosts so existing approvals are kept.
   */
  cookieConsent?: {
    /** Hosts the user has accepted (e.g. ["sentry.io", ".example.com"]). */
    acceptedHosts: string[]
    /** Hosts that were in config when user last consented; used to detect new cookies and re-collect consent. */
    consentedCookieHosts: string[]
  }
  /** Override layout at runtime: 'sidebar' | 'fullscreen' | 'windows'. When set, overrides config.layout (e.g. from Develop settings). */
  layout?: 'sidebar' | 'fullscreen' | 'windows'
  /** Root-level navigation items (injected by shell when sending settings to sub-apps) */
  navigation?: {
    items: SettingsNavigationItem[]
  }
  // Add more settings here as needed
  // notifications: { ... }
}


export type DrawerPosition = 'top' | 'bottom' | 'left' | 'right';

/** Size as CSS length: e.g. "400px", "80vh", "50vw" */
export interface OpenDrawerOptions {
  url?: string;
  position?: DrawerPosition;
  /** CSS length for drawer size: height for top/bottom (e.g. "80vh", "400px"), width for left/right (e.g. "50vw", "320px") */
  size?: string;
}

export type ShellUIMessageType =
  | 'SHELLUI_URL_CHANGED'
  | 'SHELLUI_OPEN_MODAL'
  | 'SHELLUI_CLOSE_MODAL'
  | 'SHELLUI_OPEN_DRAWER'
  | 'SHELLUI_CLOSE_DRAWER'
  | 'SHELLUI_NAVIGATE'
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
  | 'SHELLUI_DIALOG_CANCEL'
  | 'SHELLUI_DIALOG_SECONDARY'
  | 'SHELLUI_INITIALIZED';

export interface ShellUIMessage {
  type: ShellUIMessageType | string;
  payload:
    | ShellUIUrlPayload
    | Record<string, never>
    | { url?: string | null }
    | { url: string }
    | { url?: string; position?: DrawerPosition; size?: string }
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
