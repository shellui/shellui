import { createRequire } from 'node:module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);

const CREDENTIALS_VERSION = 2;
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
    'OS keychain entry per account via optional @napi-rs/keyring; file mode 0600 when that store is unavailable',
});

/** @type {{ active: boolean, factory: ((name: string) => KeychainEntry | null) | null }} */
let testKeychain = { active: false, factory: null };
/** @type {Map<string, KeychainEntry | null>} */
const nativeEntries = new Map();
let nativeUnavailable = false;
let warnedFileFallback = false;
let migrated = false;
/** @type {string | null} */
let activeAccountKey = null;

/**
 * @typedef {{
 *   getPassword: () => string | null,
 *   setPassword: (password: string) => void,
 *   deletePassword: () => boolean,
 * }} KeychainEntry
 */

/**
 * @param {((name: string) => KeychainEntry | null) | null} factory keychain entry per account name
 */
export function setCredentialKeychainForTests(factory) {
  testKeychain = { active: true, factory };
  warnedFileFallback = false;
  migrated = false;
  activeAccountKey = null;
}

export function resetCredentialKeychainForTests() {
  testKeychain = { active: false, factory: null };
  warnedFileFallback = false;
  migrated = false;
  activeAccountKey = null;
}

/**
 * @param {string} name keychain account name
 * @returns {KeychainEntry | null}
 */
function keychainEntry(name) {
  if (testKeychain.active) return testKeychain.factory ? testKeychain.factory(name) : null;
  if (process.env.VITEST || nativeUnavailable) return null;
  if (nativeEntries.has(name)) return nativeEntries.get(name) ?? null;
  try {
    const { Entry } = require('@napi-rs/keyring');
    const entry = new Entry(KEYCHAIN_SERVICE, name, { linux: { store: 'secret-service' } });
    nativeEntries.set(name, entry);
    return entry;
  } catch {
    nativeUnavailable = true;
    return null;
  }
}

/**
 * Stable key for one account: identity URL plus company id.
 * @param {{ backendUrl: string, companyId: string | number }} account
 */
export function accountKey(account) {
  return `${String(account.backendUrl).trim().replace(/\/+$/, '')}#${String(account.companyId).trim()}`;
}

/** @param {string} key */
function keychainName(key) {
  return `${KEYCHAIN_ACCOUNT}:${key}`;
}

/**
 * Pick the account later reads use by default (for example from shellui.config.json).
 * @param {{ backendUrl: string, companyId: string | number } | null} account
 */
export function setActiveAccount(account) {
  activeAccountKey = account && String(account.companyId ?? '').trim() ? accountKey(account) : null;
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

function getIndexPath() {
  return path.join(getCredentialsDir(), 'accounts.json');
}

function ensureDir() {
  const dir = getCredentialsDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows may ignore chmod
  }
}

/**
 * @param {string} filePath
 * @param {unknown} value
 */
function writePrivateJson(filePath, value) {
  ensureDir();
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Windows may ignore chmod
  }
}

/** @param {string} filePath */
function readJson(filePath) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
  } catch {
    return null;
  }
}

/**
 * Account index (no tokens): known account keys and the current one.
 * @returns {{ current: string | null, accounts: string[] }}
 */
function readIndex() {
  const raw = readJson(getIndexPath());
  const accounts = Array.isArray(raw?.accounts)
    ? raw.accounts.filter((/** @type {unknown} */ k) => typeof k === 'string')
    : [];
  const current = typeof raw?.current === 'string' ? raw.current : null;
  return { current, accounts };
}

/** @param {{ current: string | null, accounts: string[] }} index */
function writeIndex(index) {
  writePrivateJson(getIndexPath(), { version: CREDENTIALS_VERSION, ...index });
}

/**
 * File fallback: tokens per account key, mode 0600.
 * @returns {Record<string, unknown>}
 */
function readFileAccounts() {
  const raw = readJson(getCredentialsPath());
  if (raw && typeof raw === 'object' && raw.accounts && typeof raw.accounts === 'object') {
    return /** @type {Record<string, unknown>} */ (raw.accounts);
  }
  return {};
}

/** @param {Record<string, unknown>} accounts */
function writeFileAccounts(accounts) {
  const filePath = getCredentialsPath();
  if (Object.keys(accounts).length === 0) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  writePrivateJson(filePath, { version: CREDENTIALS_VERSION, accounts });
}

/**
 * Move the old single-slot login (keychain `cli-credentials` or flat v1 file) to a per-account entry.
 */
function migrateLegacy() {
  if (migrated) return;
  migrated = true;
  const legacyEntry = keychainEntry(KEYCHAIN_ACCOUNT);
  if (legacyEntry) {
    try {
      const raw = legacyEntry.getPassword();
      const legacy = raw ? credentialsFromRaw(JSON.parse(raw)) : null;
      if (legacy) writeCredentials(legacy, { makeCurrent: !readIndex().current });
      if (raw) legacyEntry.deletePassword();
    } catch {
      // Leave the legacy entry; the login keeps working on next run.
    }
  }
  const rawFile = readJson(getCredentialsPath());
  const legacyFile = rawFile && !rawFile.accounts ? credentialsFromRaw(rawFile) : null;
  if (legacyFile) {
    fs.unlinkSync(getCredentialsPath());
    writeCredentials(legacyFile, { makeCurrent: !readIndex().current });
  }
}

/**
 * @param {string} key
 */
function readAccount(key) {
  const entry = keychainEntry(keychainName(key));
  if (entry) {
    try {
      const raw = entry.getPassword();
      const parsed = raw ? credentialsFromRaw(JSON.parse(raw)) : null;
      if (parsed) return parsed;
    } catch {
      // try the file fallback
    }
  }
  return credentialsFromRaw(readFileAccounts()[key]);
}

/**
 * Read one account's credentials: the given account, else the active one, else the current login.
 * @param {{ backendUrl: string, companyId: string | number } | null} [account]
 */
export function readCredentials(account = null) {
  migrateLegacy();
  const key = account ? accountKey(account) : activeAccountKey || readIndex().current;
  return key ? readAccount(key) : null;
}

/**
 * Keys of every stored account (no tokens).
 * @returns {string[]}
 */
export function listAccounts() {
  migrateLegacy();
  return [...new Set([...readIndex().accounts, ...Object.keys(readFileAccounts())])];
}

/**
 * Persist one account: OS keychain first, 0600 file fallback. Dir 0700.
 * @param {{
 *   backendUrl: string,
 *   companyId: string | number,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt?: number | null,
 *   tokenType?: string,
 * }} session
 * @param {{ makeCurrent?: boolean }} [options]
 */
export function writeCredentials(session, options = {}) {
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
  const key = accountKey(payload);
  const fileAccounts = readFileAccounts();
  const entry = keychainEntry(keychainName(key));
  let inKeychain = false;
  if (entry) {
    try {
      entry.setPassword(JSON.stringify(payload));
      inKeychain = true;
    } catch (error) {
      warnFileFallback(error);
    }
  } else {
    warnFileFallback(new Error('OS keychain is not available'));
  }
  if (inKeychain) delete fileAccounts[key];
  else fileAccounts[key] = payload;
  writeFileAccounts(fileAccounts);

  const index = readIndex();
  const makeCurrent = options.makeCurrent ?? true;
  writeIndex({
    current: makeCurrent ? key : index.current,
    accounts: index.accounts.includes(key) ? index.accounts : [...index.accounts, key],
  });
}

/**
 * Remove one account (given, active, or current).
 * @param {{ backendUrl: string, companyId: string | number } | null} [account]
 * @returns {boolean} true if something was removed
 */
export function clearCredentials(account = null) {
  migrateLegacy();
  const index = readIndex();
  const key = account ? accountKey(account) : activeAccountKey || index.current;
  if (!key) return false;
  let removed = false;
  const entry = keychainEntry(keychainName(key));
  if (entry) {
    try {
      removed = Boolean(entry.deletePassword());
    } catch {
      // Still remove the file fallback.
    }
  }
  const fileAccounts = readFileAccounts();
  if (key in fileAccounts) {
    delete fileAccounts[key];
    writeFileAccounts(fileAccounts);
    removed = true;
  }
  const accounts = index.accounts.filter((k) => k !== key);
  if (accounts.length !== index.accounts.length) removed = true;
  if (accounts.length === 0) {
    if (fs.existsSync(getIndexPath())) fs.unlinkSync(getIndexPath());
  } else {
    writeIndex({ current: index.current === key ? null : index.current, accounts });
  }
  return removed;
}
