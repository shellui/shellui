import fs from 'fs';
import os from 'os';
import path from 'path';

const CREDENTIALS_VERSION = 1;

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
export function readCredentials() {
  const filePath = getCredentialsPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  const filePath = getCredentialsPath();
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
