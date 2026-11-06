import { readCliSessionFile } from './session-file.js';
import { readCredentials, setActiveAccount } from '../auth/credentials.js';
import { resolveAuthTarget, useConfigAccount } from '../auth/resolve-target.js';

/**
 * @param {{ root?: string, config?: string, company?: string }} options
 * @returns {{ companyId: string, source: 'flag' | 'cli-session' | 'config', configDir: string | null, backendUrl: string }}
 */
export function resolveCompanyScope(options = {}) {
  const target = resolveAuthTarget({ root: options.root ?? '.', config: options.config });
  const backendUrl = target.backendUrl;
  const configDir = target.configDir;
  const flag =
    typeof options.company === 'string' && options.company.trim() ? options.company.trim() : '';

  if (flag) {
    if (!/^\d+$/.test(flag)) {
      throw new Error('company id must be numeric digits (for example --company 7).');
    }
    setActiveAccount({ backendUrl, companyId: flag });
    return { companyId: flag, source: 'flag', configDir, backendUrl };
  }

  const session = readCliSessionFile();
  const creds = readCredentials();
  if (
    session?.defaultCompanyId &&
    session.backendUrl &&
    creds?.backendUrl &&
    session.backendUrl === creds.backendUrl.replace(/\/+$/, '')
  ) {
    setActiveAccount({ backendUrl, companyId: session.defaultCompanyId });
    return {
      companyId: String(session.defaultCompanyId),
      source: 'cli-session',
      configDir,
      backendUrl,
    };
  }

  if (target.companyId) {
    useConfigAccount({ root: options.root, config: options.config });
    return {
      companyId: String(target.companyId),
      source: 'config',
      configDir,
      backendUrl,
    };
  }

  throw new Error(
    'No company id. Set backend.companyId in shellui.config.json, run shellui companies use <id>, or pass --company <id>.',
  );
}
