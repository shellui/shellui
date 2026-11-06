import pc from 'picocolors';

import { getCredentialsPath, getCredentialStorageInfo, listAccounts } from '../auth/credentials.js';
import { useConfigAccount } from '../auth/resolve-target.js';
import { authFetch, isAccessTokenExpired, loadValidSession } from '../auth/session.js';
import { readCliSessionFile } from '../cli-context/session-file.js';
import { printCliJson } from './cli-output.js';

/**
 * @param {string} [_root]
 * @param {{ config?: string, json?: boolean }} options
 */
export async function authStatusCommand(_root = '.', options = {}) {
  useConfigAccount({ root: _root, config: /** @type {string | undefined} */ (options.config) });

  const jsonMode = options.json === true;
  const session = await loadValidSession();
  const sessionFile = readCliSessionFile();

  const accounts = listAccounts();
  const storageInfo = getCredentialStorageInfo();

  /** @type {Record<string, unknown>} */
  const out = {
    loggedIn: Boolean(session),
    credentialAccounts: accounts.length,
    credentialStorage: {
      format: storageInfo.format,
      unixPermissions: storageInfo.unixPermissions,
      path: getCredentialsPath(),
    },
    cliSession: sessionFile
      ? {
          defaultCompanyId: sessionFile.defaultCompanyId ?? null,
          backendUrl: sessionFile.backendUrl ?? null,
        }
      : null,
  };

  if (session) {
    out.backendUrl = session.backendUrl;
    out.companyId = session.companyId;
    out.accessTokenExpired = isAccessTokenExpired(session);
    try {
      const { response } = await authFetch('/api/v1/user');
      out.userHttpStatus = response.status;
      if (response.ok) {
        const user = await response.json().catch(() => null);
        if (user && typeof user === 'object') {
          const meta =
            user.user_metadata && typeof user.user_metadata === 'object'
              ? /** @type {Record<string, unknown>} */ (user.user_metadata)
              : {};
          out.user = {
            id: user.id != null ? String(user.id) : null,
            email: typeof user.email === 'string' ? user.email : null,
            name:
              (typeof meta.full_name === 'string' && meta.full_name) ||
              (typeof meta.name === 'string' && meta.name) ||
              null,
          };
        }
      }
    } catch {
      out.userHttpStatus = 'error';
    }
  }

  if (jsonMode) {
    printCliJson(out);
    return;
  }

  if (!session) {
    console.log(pc.yellow('Not logged in. Run shellui login.'));
    console.log(pc.dim(`Credential file: ${getCredentialsPath()}`));
    if (sessionFile?.defaultCompanyId) {
      console.log(
        pc.dim(
          `CLI default company (applies when logged in): ${sessionFile.defaultCompanyId}` +
            (sessionFile.backendUrl ? ` @ ${sessionFile.backendUrl}` : ''),
        ),
      );
    }
    return;
  }

  if (out.user && typeof out.user === 'object') {
    const u = /** @type {{ email?: string | null, name?: string | null }} */ (out.user);
    if (u.email) console.log(`${pc.bold('Email:')} ${u.email}`);
    if (u.name) console.log(`${pc.bold('Name:')}  ${u.name}`);
  }
  console.log(`${pc.bold('Company:')} ${session.companyId}`);
  console.log(`${pc.bold('Backend:')} ${session.backendUrl}`);
  if (sessionFile?.defaultCompanyId && sessionFile.defaultCompanyId !== session.companyId) {
    console.log(
      pc.dim(
        `CLI default company (shellui companies use): ${sessionFile.defaultCompanyId}` +
          (sessionFile.backendUrl ? ` @ ${sessionFile.backendUrl}` : ''),
      ),
    );
  }
  console.log(pc.dim(`Credentials: ${getCredentialsPath()} (${storageInfo.format})`));
}
