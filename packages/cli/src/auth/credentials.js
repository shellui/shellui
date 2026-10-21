import { createRequire } from 'node:module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);

const CREDENTIALS_VERSION = 1;
const KEYCHAIN_SERVICE = 'shellui';
const KEYCHAIN_ACCOUNT = 'cli-credentials';

/**
 * Tokens go to the OS keychain when `@napi-rs/keyring` can open it.
 * Otherwise they stay in a mode 0600 file. Same-user access can still read a file fallback.
 */
export const CREDENTIAL_STORAGE_RESIDUAL = Object.freeze({
  format: 'os-keychain-with-0600-file-fallback',
  unixPermissions: { directory: '0700', file: '0600' },
  windowsPermissions: 'best-effort-chmod; relies on %APPDATA% ACLs',
  notProtectedAgainst: [
    'same-user malware when the keychain is unavailable',
    'root/admin access',
    'backup tools copying the file fallback',
    'disk imaging of the file fallback',
  ],
  followUp:
    'OS keychain via optional @napi-rs/keyring; file mode 0600 when that store is unavailable',
});

/** @type {{ active: boolean, entry: KeychainEntry | null }} */
let testKeychain = { active: false, entry: null };
/** @type {KeychainEntry | null | undefined} */
let nativeEntry;
let warnedFileFallback = false;

/**
 * @typedef {{
 *   getPassword: () => string | null,
 *   setPassword: (password: string) => void,
 *   deletePassword: () => boolean,
 * }} KeychainEntry
 */

/**
 * @param {KeychainEntry | null} entry
 */
export function setCredentialKeychainForTests(entry) {
  testKeychain = { active: true, entry };
  warnedFileFallback = false;
}

export function resetCredentialKeychainForTests() {
  testKeychain = { active: false, entry: null };
  warnedFileFallback = false;
}

/**
 * @returns {KeychainEntry | null}
 */
function keychainEntry() {
  if (testKeychain.active) return testKeychain.entry;
  if (process.env.VITEST) return null;
  if (nativeEntry !== undefined) return nativeEntry;
  try {
    const { Entry } = require('@napi-rs/keyring');
    nativeEntry = new Entry(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, {
      linux: { store: 'secret-service' },
    });
  } catch {
    nativeEntry = null;
  }
  return nativeEntry;
}

/**
 * @param {unknown} error
 */
function warnFileFallback(error) {
  if (process.env.VITEST && !testKeychain.active) return;
  if (warnedFileFallback) return;
  warnedFileFallback = true;
  const reason = error instanceof Error ? error.message : 'OS keychain is not available';
  console.warn(
    `Shellui could not use the OS keychain (${reason}). CLI credentials were saved to ${getCredentialsPath()} with mode 0600.`,
  );
}

/**
 * @returns {typeof CREDENTIAL_STORAGE_RESIDUAL}
 */
export function getCredentialStorageInfo() {
  return CREDENTIAL_STORAGE_RESIDUAL;
}

/**
 * Resolve the directory for shellui CLI credentials (XDG / AppData).
 * @returns {string}
 */
export function getCredentialsDir() {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'shellui');
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim()) {
    return path.join(xdg.trim(), 'shellui');
  }
  return path.join(os.homedir(), '.config', 'shellui');
}

/**
 * @returns {string}
 */
export function getCredentialsPath() {
  return path.join(getCredentialsDir(), 'credentials.json');
}

/**
 * @param {unknown} value
 * @returns {value is {
 *   version: number,
 *   backendUrl: string,
 *   companyId: string,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt: number | null,
 *   tokenType: string,
 * }}
 */
export function isCredentialsShape(value) {
  if (!value || typeof value !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof o.backendUrl === 'string' &&
    o.backendUrl.trim() !== '' &&
    typeof o.companyId === 'string' &&
    o.companyId.trim() !== '' &&
    typeof o.accessToken === 'string' &&
    o.accessToken.trim() !== '' &&
    typeof o.refreshToken === 'string' &&
    o.refreshToken.trim() !== ''
  );
}

/**
 * @returns {ReturnType<typeof isCredentialsShape> extends true ? object : null}
 */
/**
 * @param {unknown} raw
 */
function credentialsFromRaw(raw) {
  if (!isCredentialsShape(raw)) return null;
  return {
    version: typeof raw.version === 'number' ? raw.version : CREDENTIALS_VERSION,
    backendUrl: String(raw.backendUrl).replace(/\/$/, ''),
    companyId: String(raw.companyId).trim(),
    accessToken: String(raw.accessToken),
    refreshToken: String(raw.refreshToken),
    expiresAt:
      typeof raw.expiresAt === 'number' && Number.isFinite(raw.expiresAt) ? raw.expiresAt : null,
    tokenType: typeof raw.tokenType === 'string' && raw.tokenType ? raw.tokenType : 'bearer',
  };
}

function readKeychainCredentials() {
  const entry = keychainEntry();
  if (!entry) return null;
  try {
    const raw = entry.getPassword();
    if (!raw) return null;
    return credentialsFromRaw(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readCredentials() {
  const fromKeychain = readKeychainCredentials();
  if (fromKeychain) return fromKeychain;
  const filePath = getCredentialsPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    return credentialsFromRaw(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return null;
  }
}

/**
 * Persist credentials with restrictive permissions (dir 0700, file 0600).
 * @param {{
 *   backendUrl: string,
 *   companyId: string | number,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt?: number | null,
 *   tokenType?: string,
 * }} session
 */
export function writeCredentials(session) {
  const dir = getCredentialsDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows may ignore chmod
  }
  const payload = {
    version: CREDENTIALS_VERSION,
    backendUrl: String(session.backendUrl).replace(/\/$/, ''),
    companyId: String(session.companyId).trim(),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt:
      typeof session.expiresAt === 'number' && Number.isFinite(session.expiresAt)
        ? session.expiresAt
        : null,
    tokenType: session.tokenType || 'bearer',
  };
  const entry = keychainEntry();
  if (entry) {
    try {
      entry.setPassword(JSON.stringify(payload));
      const filePath = getCredentialsPath();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    } catch (error) {
      warnFileFallback(error);
    }
  } else {
    warnFileFallback(new Error('OS keychain is not available'));
  }
  const filePath = getCredentialsPath();
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Windows may ignore chmod
  }
}

/**
 * Remove stored credentials if present.
 * @returns {boolean} true if a file was removed
 */
export function clearCredentials() {
  let removed = false;
  const entry = keychainEntry();
  if (entry) {
    try {
      removed = Boolean(entry.deletePassword());
    } catch {
      // Still remove the file fallback.
    }
  }
  const filePath = getCredentialsPath();
  if (!fs.existsSync(filePath)) return removed;
  fs.unlinkSync(filePath);
  return true;
}
