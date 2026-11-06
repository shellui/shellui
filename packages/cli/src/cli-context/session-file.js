import fs from 'fs';
import os from 'os';
import path from 'path';

import { getCredentialsDir } from '../auth/credentials.js';

const SESSION_VERSION = 1;
const SESSION_FILENAME = 'cli-session.json';

/** @returns {string} */
export function getCliSessionPath() {
  return path.join(getCredentialsDir(), SESSION_FILENAME);
}

/**
 * @returns {{
 *   version: number,
 *   backendUrl?: string,
 *   defaultCompanyId?: string,
 * } | null}
 */
export function readCliSessionFile() {
  const filePath = getCliSessionPath();
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.version !== 'number') return null;
    const backendUrl =
      typeof raw.backendUrl === 'string' && raw.backendUrl.trim()
        ? raw.backendUrl.replace(/\/+$/, '')
        : undefined;
    const defaultCompanyId =
      typeof raw.defaultCompanyId === 'string' && /^\d+$/.test(raw.defaultCompanyId.trim())
        ? raw.defaultCompanyId.trim()
        : undefined;
    return { version: raw.version, backendUrl, defaultCompanyId };
  } catch {
    return null;
  }
}

/**
 * @param {{ backendUrl: string, defaultCompanyId: string }} input
 */
export function writeCliSessionFile(input) {
  const dir = getCredentialsDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows may ignore chmod
  }
  const payload = {
    version: SESSION_VERSION,
    backendUrl: String(input.backendUrl).replace(/\/+$/, ''),
    defaultCompanyId: String(input.defaultCompanyId).trim(),
  };
  const filePath = getCliSessionPath();
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
