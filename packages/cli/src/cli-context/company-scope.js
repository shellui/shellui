import { readCliSessionFile } from './session-file.js';
import { readCredentials, setActiveAccount } from '../auth/credentials.js';
import { resolveAuthTarget, useConfigAccount } from '../auth/resolve-target.js';

const DASHBOARD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Regional tenant id (identity `company_id` claim / backend.companyId): decimal digits only.
 * @param {string} value
 */
export function validateRegionalCompanyId(value) {
  const v = String(value).trim();
  if (!/^\d+$/.test(v)) {
    throw new Error(
      'Regional company id must be decimal digits (identity tenant). Dashboard records use a separate UUID; see `shellui projects list`.',
    );
  }
  return v;
}

/**
 * @param {{ root?: string, config?: string, company?: string }} options
 * @returns {{ companyId: string, source: 'flag' | 'cli-session' | 'config', configDir: string | null, backendUrl: string }}
 */
export function resolveRegionalCompanyScope(options = {}) {
  const target = resolveAuthTarget({ root: options.root ?? '.', config: options.config });
  const backendUrl = target.backendUrl;
  const configDir = target.configDir;
  const flag =
    typeof options.company === 'string' && options.company.trim() ? options.company.trim() : '';

  if (flag) {
    const companyId = validateRegionalCompanyId(flag);
    setActiveAccount({ backendUrl, companyId });
    return { companyId, source: 'flag', configDir, backendUrl };
  }

  const session = readCliSessionFile();
  const creds = readCredentials();
  if (
    session?.regionalCompanyId &&
    session.backendUrl &&
    creds?.backendUrl &&
    session.backendUrl === creds.backendUrl.replace(/\/+$/, '')
  ) {
    const companyId = validateRegionalCompanyId(session.regionalCompanyId);
    setActiveAccount({ backendUrl, companyId });
    return {
      companyId,
      source: 'cli-session',
      configDir,
      backendUrl,
    };
  }

  if (target.companyId) {
    const companyId = validateRegionalCompanyId(target.companyId);
    useConfigAccount({ root: options.root, config: options.config });
    return {
      companyId,
      source: 'config',
      configDir,
      backendUrl,
    };
  }

  throw new Error(
    'No regional company id. Set backend.companyId in shellui.config.json, run shellui companies use <id>, or pass --company <id> (decimal digits).',
  );
}

/**
 * Dashboard global company UUID for SaaS paths (not a regional tenant id).
 * @param {string} value
 */
export function validateDashboardCompanyUuid(value) {
  const v = String(value).trim();
  if (!DASHBOARD_UUID_RE.test(v)) {
    throw new Error('Dashboard company id must be a UUID (from shellui projects list).');
  }
  return v.toLowerCase();
}

/**
 * Default dashboard company UUID from CLI session (optional).
 * @param {{ root?: string, config?: string }} [options]
 * @returns {string | null}
 */
export function resolveDashboardCompanyUuidFromSession(options = {}) {
  const target = resolveAuthTarget({ root: options.root ?? '.', config: options.config });
  const session = readCliSessionFile();
  const creds = readCredentials();
  if (
    session?.dashboardCompanyUuid &&
    session.backendUrl &&
    creds?.backendUrl &&
    session.backendUrl === creds.backendUrl.replace(/\/+$/, '')
  ) {
    return validateDashboardCompanyUuid(session.dashboardCompanyUuid);
  }
  return null;
}

/** @deprecated Use resolveRegionalCompanyScope */
export const resolveCompanyScope = resolveRegionalCompanyScope;
