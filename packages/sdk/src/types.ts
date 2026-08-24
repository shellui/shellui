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
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
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
  path: string;
  url: string;
  label?: string;
  icon?: string;
}

/**
 * Custom admin-panel navigation item (from host `administration.navigation`).
 * Labels are resolved to the active language before propagation.
 */
export interface SettingsAdministrationNavigationItem {
  path: string;
  url: string;
  label: string;
  icon?: string;
  /** When true, only staff users should see this item in the admin sidebar. */
  requiresStaff?: boolean;
  /**
   * How to open the item in the admin panel.
   * - `default` (or omitted): embed `url` in a content iframe
   * - `external`: open `url` in a new tab (`target="_blank"`) — use for apps that block iframes (e.g. Django admin)
   */
  openIn?: 'default' | 'external';
}

/**
 * Custom navigation section for the staff admin panel (from host `administration`).
 * Injected by the shell when sending settings to iframes.
 */
export interface SettingsAdministration {
  title: string;
  navigation: SettingsAdministrationNavigationItem[];
}

/**
 * Storage-service connection from host `storage` in shellui.config.json.
 * Used by Admin → Storage, Settings → Storage (quota), and the SDK file API
 * (`shellui.storage`) which the shell executes against this URL.
 */
export interface SettingsStorage {
  /** Base URL of storage-service (no trailing slash). */
  url: string;
  /** Files explorer app URL when configured. */
  filesUrl?: string | null;
}

/** Single mode color set (light or dark). All values provided so apps can style without knowing theme. */
export interface ThemeColorsMode {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

/** Theme colors for both light and dark modes. */
export interface ThemeColors {
  light: ThemeColorsMode;
  dark: ThemeColorsMode;
}

/**
 * Full theme object with all variable values so applications can style without knowing the theme name.
 */
export interface SettingsTheme {
  name: string;
  displayName: string;
  /** Resolved color mode currently in use (from colorScheme + system preference). */
  mode: 'light' | 'dark';
  colors: ThemeColors;
  fontFamily?: string;
  bodyFontFamily?: string;
  headingFontFamily?: string;
  letterSpacing?: string;
  textShadow?: string;
  lineHeight?: string;
  fontFiles?: string[];
}

/**
 * Slim theme descriptor for the list of available themes (e.g. theme picker).
 * Injected by shell when sending settings to sub-apps; includes name, displayName,
 * light/dark ThemeColorsMode, and optional typography used for preview.
 */
export interface SettingsAvailableTheme {
  name: string;
  displayName: string;
  colors: ThemeColors;
  fontFamily?: string;
  letterSpacing?: string;
  textShadow?: string;
}

/**
 * Appearance settings: full theme values plus user color scheme preference.
 * This is the default structure for settings.appearance.
 */
export interface Appearance extends SettingsTheme {
  /** User preference: light, dark, or follow system. */
  colorScheme: 'light' | 'dark' | 'system';
  /**
   * List of available themes (name, displayName, light/dark colors, optional typography).
   * Set by shell when propagating settings to sub-apps so they can render a theme picker.
   */
  availableThemes?: SettingsAvailableTheme[];
}

export interface SettingsUser {
  id: string | null;
  email: string | null;
  name: string | null;
  profilePicture: string | null;
  authProvider: string | null;
  /** Optional snapshot of group names propagated to iframe apps (e.g. from JWT). */
  groups?: string[] | null;
  /** Staff flag from the shell session (Django `is_staff`). */
  isStaff?: boolean;
  /** Company-owner flag from the shell session for the active tenant. */
  isCompanyOwner?: boolean;
}

export interface Settings {
  developerFeatures: {
    enabled: boolean;
    /**
     * When true, skips proactive / restore token refresh so an access token can expire
     * for local testing (Settings → Develop).
     */
    disableTokenAutoRefresh?: boolean;
  };
  /** User toggle for sending error reports (only relevant when app has reporting configured). */
  errorReporting: {
    enabled: boolean;
  };
  logging: {
    namespaces: {
      shellsdk: boolean;
      shellcore: boolean;
    };
  };
  appearance: Appearance;
  language: {
    code: 'en' | 'fr';
  };
  region: {
    timezone: string;
  };
  /**
   * Cookie consent: hosts the user has accepted. Only enable a feature when its cookie host is in acceptedHosts.
   * consentedCookieHosts = list of hosts that were in config when user last gave consent; if config has a host
   * not in this list, re-prompt and pre-fill with acceptedHosts so existing approvals are kept.
   */
  cookieConsent?: {
    /** Hosts the user has accepted (e.g. ["sentry.io", ".example.com"]). */
    acceptedHosts: string[];
    /** Hosts that were in config when user last consented; used to detect new cookies and re-collect consent. */
    consentedCookieHosts: string[];
  };
  /** Service worker settings (caching, offline) */
  serviceWorker?: {
    /** Whether the service worker is enabled */
    enabled: boolean;
  };
  /** Override layout at runtime: 'sidebar' | 'fullscreen' | 'windows' | 'app-bar'. When set, overrides config.layout (e.g. from Develop settings). */
  layout?: 'sidebar' | 'fullscreen' | 'windows' | 'app-bar';
  /** Root-level navigation items (injected by shell when sending settings to sub-apps) */
  navigation?: {
    items: SettingsNavigationItem[];
  };
  /**
   * Custom admin-panel navigation (from host `administration` in shellui.config.json).
   * Consumed by the staff admin app to render extra sidebar links below Dashboard.
   */
  administration?: SettingsAdministration | null;
  /**
   * Storage-service connection (from host `storage` in shellui.config.json).
   * When set, Admin shows Storage and iframe apps can call `shellui.storage`.
   * Settings → Storage (quota) is a host UI and is omitted when `storage` is
   * unset or `showInSettings` is false.
   */
  storage?: SettingsStorage | null;
  /** Authenticated user snapshot injected by shell for sub-apps. */
  user?: SettingsUser | null;
  /**
   * Session JWT (access token) injected by shell for trusted iframe apps.
   * Same token as the main app’s API `Authorization: Bearer` credential; omitted or null for untrusted frames.
   */
  accessToken?: string | null;
  /**
   * ShellUI-auth API base URL (no trailing slash), from the parent app’s `backend.url` when `backend.type` is `shellui`.
   * Injected for trusted sub-apps (e.g. admin iframe) so they call the same backend as the shell.
   */
  authBackendBaseUrl?: string | null;
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

/**
 * Minimal login payload used when a nested iframe requests the root shell
 * to perform authentication (e.g. OAuth redirect from top-level window).
 */
export interface LoginOptions {
  /** Login strategy currently requested. */
  method: 'oauth' | 'web3';
  /** OAuth provider id (e.g. "github", "google"). Required for oauth. */
  provider?: string;
  /** Web3 chain id. Defaults to ethereum in shell. */
  chain?: 'ethereum';
  /** Optional route that should receive the auth callback. */
  redirectPath?: string;
  /** Optional company OAuth client id when backend supports per-tenant keys. */
  oauthClientId?: number;
}

/** What the storage picker can choose. `folders` never selects files. */
export type StorageSelectMode = 'folders' | 'files' | 'any';

export type StorageSelectOptions = {
  /** Allow more than one item. Default: `false`. */
  multiple?: boolean;
  /**
   * - `folders` — folders only (files are hidden)
   * - `files` — files only (folders are for navigation)
   * - `any` — files and folders
   */
  mode?: StorageSelectMode;
};

/**
 * One picked file or folder. Keep `id` to survive a later rename; `path` is the
 * location at the moment of selection.
 */
export type StorageSelectedItem = {
  /** Stable id (file UUID, or folder placeholder UUID). */
  id: string;
  bucket: string;
  /** Current path in the bucket (`''` = bucket root). */
  path: string;
  name: string;
  type: 'file' | 'folder';
};

export type StorageSelectResult = {
  items: StorageSelectedItem[];
};

export type StorageSelectRequestPayload = {
  id: string;
  multiple: boolean;
  mode: StorageSelectMode;
};

export type StorageSelectResponsePayload = {
  id: string;
  items?: StorageSelectedItem[];
  cancelled?: boolean;
  error?: { message: string; status?: number };
};

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
  | 'SHELLUI_INITIALIZED'
  | 'SHELLUI_REFRESH_PAGE'
  | 'SHELLUI_LOGOUT'
  | 'SHELLUI_LOGIN'
  | 'SHELLUI_STORAGE_REQUEST'
  | 'SHELLUI_STORAGE_RESPONSE'
  | 'SHELLUI_SELECT_STORAGE'
  | 'SHELLUI_SELECT_STORAGE_RESULT'
  | 'SHELLUI_UPLOAD_TOAST_DEMO';

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
