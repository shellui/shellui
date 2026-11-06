import fs from 'fs';
import path from 'path';

import { getCredentialsDir } from '../auth/credentials.js';

const SESSION_VERSION = 2;
const SESSION_FILENAME = 'cli-session.json';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @returns {string} */
export function getCliSessionPath() {
  return path.join(getCredentialsDir(), SESSION_FILENAME);
}

/**
 * @returns {{
 *   version: number,
 *   backendUrl?: string,
 *   regionalCompanyId?: string,
 *   dashboardCompanyUuid?: string,
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

    let regionalCompanyId;
    if (typeof raw.regionalCompanyId === 'string' && /^\d+$/.test(raw.regionalCompanyId.trim())) {
      regionalCompanyId = raw.regionalCompanyId.trim();
    } else if (
      typeof raw.defaultCompanyId === 'string' &&
      /^\d+$/.test(raw.defaultCompanyId.trim())
    ) {
      regionalCompanyId = raw.defaultCompanyId.trim();
    }

    let dashboardCompanyUuid;
    if (
      typeof raw.dashboardCompanyUuid === 'string' &&
      UUID_RE.test(raw.dashboardCompanyUuid.trim())
    ) {
      dashboardCompanyUuid = raw.dashboardCompanyUuid.trim().toLowerCase();
    }

    return { version: raw.version, backendUrl, regionalCompanyId, dashboardCompanyUuid };
  } catch {
    return null;
  }
}

/**
 * @param {{ backendUrl: string, regionalCompanyId: string }} input
 */
export function writeCliRegionalSessionFile(input) {
  const prev = readCliSessionFile();
  writeCliSessionFileMerged({
    backendUrl: input.backendUrl,
    regionalCompanyId: input.regionalCompanyId,
    dashboardCompanyUuid: prev?.dashboardCompanyUuid,
  });
}

/**
 * @param {{ backendUrl: string, dashboardCompanyUuid: string }} input
 */
export function writeCliDashboardSessionFile(input) {
  const prev = readCliSessionFile();
  writeCliSessionFileMerged({
    backendUrl: input.backendUrl,
    regionalCompanyId: prev?.regionalCompanyId,
    dashboardCompanyUuid: input.dashboardCompanyUuid,
  });
}

/**
 * @param {{
 *   backendUrl: string,
 *   regionalCompanyId?: string,
 *   dashboardCompanyUuid?: string,
 * }} input
 */
function writeCliSessionFileMerged(input) {
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
    ...(input.regionalCompanyId
      ? { regionalCompanyId: String(input.regionalCompanyId).trim() }
      : {}),
    ...(input.dashboardCompanyUuid
      ? { dashboardCompanyUuid: String(input.dashboardCompanyUuid).trim().toLowerCase() }
      : {}),
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
