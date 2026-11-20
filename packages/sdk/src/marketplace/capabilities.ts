/**
 * Per-app capabilities for Shellui Marketplace installs.
 * Static config frames have no grant and keep their existing behavior.
 * Third-party grants never include sign-in (`auth`) or child frames.
 */

export const APP_CAPABILITIES = [
  'theme',
  'locale',
  'ui',
  'navigate',
  'storage',
  'ai',
  'auth',
] as const;

export type AppCapability = (typeof APP_CAPABILITIES)[number];

export const DEFAULT_APP_CAPABILITIES: readonly AppCapability[] = ['theme', 'locale'];

export const GRANTABLE_EXTRA_CAPABILITIES: readonly AppCapability[] = [
  'ui',
  'navigate',
  'storage',
  'ai',
];

/** Inbound messages the host accepts only from `marketplace.url`. */
export const MARKETPLACE_REQUEST_TYPES = new Set([
  'SHELLUI_MARKETPLACE_LIST',
  'SHELLUI_MARKETPLACE_INSTALL',
  'SHELLUI_MARKETPLACE_UNINSTALL',
]);

const MESSAGE_CAPABILITY: Record<string, AppCapability | 'childFrames'> = {
  SHELLUI_LOGIN: 'auth',
  SHELLUI_LOGOUT: 'auth',
  SHELLUI_DELETE_ACCOUNT_REQUEST: 'auth',
  SHELLUI_UPDATE_PROFILE_REQUEST: 'auth',
  SHELLUI_CHILD_FRAME_REGISTER: 'childFrames',
  SHELLUI_CHILD_FRAME_UNREGISTER: 'childFrames',
  SHELLUI_OPEN_MODAL: 'ui',
  SHELLUI_CLOSE_MODAL: 'ui',
  SHELLUI_OPEN_DRAWER: 'ui',
  SHELLUI_CLOSE_DRAWER: 'ui',
  SHELLUI_TOAST: 'ui',
  SHELLUI_TOAST_UPDATE: 'ui',
  SHELLUI_DIALOG: 'ui',
  SHELLUI_DIALOG_UPDATE: 'ui',
  SHELLUI_ACTIONS_SET: 'ui',
  SHELLUI_ACTIONS_CLEAR: 'ui',
  SHELLUI_OVERLAY_SIZE: 'ui',
  SHELLUI_NAVIGATE: 'navigate',
  SHELLUI_URL_CHANGED: 'navigate',
  SHELLUI_STORAGE_REQUEST: 'storage',
  SHELLUI_SELECT_STORAGE: 'storage',
  SHELLUI_AI_REQUEST: 'ai',
};

export function isAppCapability(value: unknown): value is AppCapability {
  return typeof value === 'string' && (APP_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Keep only capabilities the host may store.
 * Third-party installs always keep theme and language, and never keep `auth`
 * or `childFrames`, even when the payload asks for them.
 */
export function sanitizeCapabilityList(
  input: readonly unknown[] | undefined,
  thirdParty: boolean,
): AppCapability[] {
  const granted = new Set<AppCapability>(thirdParty ? DEFAULT_APP_CAPABILITIES : []);
  for (const entry of input ?? []) {
    if (entry === 'childFrames' || entry === 'safeForAuthToken') continue;
    if (entry === 'auth') {
      if (!thirdParty) granted.add('auth');
      continue;
    }
    if (!isAppCapability(entry)) continue;
    if (thirdParty && entry === 'auth') continue;
    granted.add(entry);
  }
  if (thirdParty) {
    granted.delete('auth');
    granted.add('theme');
    granted.add('locale');
  }
  return APP_CAPABILITIES.filter((capability) => granted.has(capability));
}

export function requiredCapabilityForMessage(
  messageType: string,
): AppCapability | 'childFrames' | null {
  return MESSAGE_CAPABILITY[messageType] ?? null;
}

export type CapabilityGrantView = {
  thirdParty: boolean;
  capabilities: ReadonlySet<string>;
};

/**
 * Fail closed for a frame that has an installed-app grant.
 * `auth` and `childFrames` are refused for third-party grants even if the set
 * still contains them.
 */
export function explainCapabilityDenial(
  messageType: string,
  grant: CapabilityGrantView | null | undefined,
): string | null {
  if (!grant) return null;
  const required = requiredCapabilityForMessage(messageType);
  if (!required) return null;
  if (grant.thirdParty && (required === 'auth' || required === 'childFrames')) {
    return `third-party apps cannot use ${required}`;
  }
  if (required === 'childFrames') {
    return 'this app cannot embed frames';
  }
  if (!grant.capabilities.has(required)) {
    return `app is missing the ${required} capability`;
  }
  return null;
}

export function explainMarketplaceRequestDenial(
  messageType: string,
  eventOrigin: string,
  marketplaceOrigin: string | null,
): string | null {
  if (!MARKETPLACE_REQUEST_TYPES.has(messageType)) return null;
  if (!marketplaceOrigin || eventOrigin !== marketplaceOrigin) {
    return 'Shellui Marketplace messages are only accepted from the configured marketplace origin';
  }
  return null;
}
