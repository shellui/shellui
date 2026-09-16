import pc from 'picocolors';
import { getCredentialsPath } from '../auth/credentials.js';
import { authFetch } from '../auth/session.js';

/**
 * @param {string} [_root]
 * @param {Record<string, unknown>} [_options]
 */
export async function whoamiCommand(_root, _options = {}) {
  let response;
  let session;
  try {
    ({ response, session } = await authFetch('/api/v1/user'));
  } catch (err) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
    return;
  }

  if (!response.ok) {
    console.error(
      pc.red(`Failed to load profile (HTTP ${response.status}). Try shellui login again.`),
    );
    process.exitCode = 1;
    return;
  }

  const payload = await response.json().catch(() => null);
  if (!payload) {
    console.error(pc.red('Invalid profile response from identity backend.'));
    process.exitCode = 1;
    return;
  }

  const meta =
    payload.user_metadata && typeof payload.user_metadata === 'object' ? payload.user_metadata : {};
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null;
  const email = typeof payload.email === 'string' ? payload.email : null;
  const id = payload.id != null ? String(payload.id) : null;

  if (name) console.log(`${pc.bold('Name:')}  ${name}`);
  if (email) console.log(`${pc.bold('Email:')} ${email}`);
  if (id) console.log(`${pc.bold('Id:')}    ${id}`);
  console.log(`${pc.bold('Company:')} ${session.companyId}`);
  console.log(`${pc.bold('Backend:')} ${session.backendUrl}`);
  console.log(pc.dim(`Credentials: ${getCredentialsPath()}`));
}
