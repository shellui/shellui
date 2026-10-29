import pc from 'picocolors';
import { clearCredentials, listAccounts, readCredentials } from '../auth/credentials.js';
import { useConfigAccount } from '../auth/resolve-target.js';
import { remoteLogout } from '../auth/session.js';

/**
 * @param {string} key
 */
function splitKey(key) {
  const i = key.lastIndexOf('#');
  return { backendUrl: key.slice(0, i), companyId: key.slice(i + 1) };
}

/**
 * Log out the current account, or every stored account with `--all`.
 * @param {string} [root]
 * @param {{ all?: boolean, config?: string }} [options]
 */
export async function logoutCommand(root = '.', options = {}) {
  if (options.all) {
    const keys = listAccounts();
    if (keys.length === 0) {
      console.log(pc.yellow('Not logged in.'));
      return;
    }
    for (const key of keys) {
      const account = splitKey(key);
      const session = readCredentials(account);
      if (session) await remoteLogout(session);
      clearCredentials(account);
    }
    console.log(pc.green(`Logged out of ${keys.length} account(s).`));
    return;
  }
  useConfigAccount({ root, config: options.config });
  const session = readCredentials();
  if (!session) {
    console.log(pc.yellow('Not logged in.'));
    return;
  }
  await remoteLogout(session);
  clearCredentials(session);
  console.log(pc.green(`Logged out of ${session.backendUrl} (company ${session.companyId}).`));
  const left = listAccounts().length;
  if (left > 0)
    console.log(pc.dim(`${left} other account(s) still signed in. Use --all to remove them.`));
}
