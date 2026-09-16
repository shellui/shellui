import pc from 'picocolors';
import { clearCredentials, readCredentials } from '../auth/credentials.js';
import { remoteLogout } from '../auth/session.js';

/**
 * @param {string} [_root]
 * @param {Record<string, unknown>} [_options]
 */
export async function logoutCommand(_root, _options = {}) {
  const session = readCredentials();
  if (!session) {
    console.log(pc.yellow('Not logged in.'));
    return;
  }
  await remoteLogout(session);
  clearCredentials();
  console.log(pc.green('Logged out.'));
}
