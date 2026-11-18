import pc from 'picocolors';

import { resolveAuthTarget, useConfigAccount } from '../auth/resolve-target.js';
import { authFetch } from '../auth/session.js';
import { validateRegionalCompanyId } from '../cli-context/company-scope.js';
import { writeCliRegionalSessionFile } from '../cli-context/session-file.js';
import { formatHttpFailure, readJsonErrorBody, redactSensitive } from '../http/service-http.js';
import { cliErrorMessage, printCliJson } from './cli-output.js';

/**
 * Regional identity organizations (`GET /api/v1/companies/`), decimal `id` in responses.
 * This is not the dashboard global company UUID (see `shellui projects list`).
 *
 * @param {'list' | 'get' | 'use'} action
 * @param {string} [arg]
 * @param {{ root?: string, config?: string, json?: boolean }} options
 */
export async function companiesCommand(action, arg, options = {}) {
  useConfigAccount({ root: options.root ?? '.', config: options.config });
  const jsonMode = options.json === true;

  try {
    if (action === 'use') {
      const id = typeof arg === 'string' && arg.trim() ? arg.trim() : '';
      if (!id || !/^\d+$/.test(id)) {
        console.error(
          pc.red('Pass a regional company id (decimal digits): shellui companies use <id>'),
        );
        process.exitCode = 1;
        return;
      }
      validateRegionalCompanyId(id);
      const target = resolveAuthTarget({ root: options.root ?? '.', config: options.config });
      if (!target.backendUrl || !target.configDir) {
        console.error(
          pc.red(
            'Need shellui.config.json with backend.url (and type shellui) to pin a default regional company.',
          ),
        );
        process.exitCode = 1;
        return;
      }
      writeCliRegionalSessionFile({ backendUrl: target.backendUrl, regionalCompanyId: id });
      if (jsonMode) {
        printCliJson({ ok: true, regionalCompanyId: id, backendUrl: target.backendUrl });
      } else {
        console.log(
          pc.green(
            `Default regional company id set to ${id} for CLI tenant scoping (identity ${target.backendUrl}).`,
          ),
        );
        console.log(
          pc.dim(
            'Dashboard global companies use UUIDs; use shellui projects list, not this id, for those records.',
          ),
        );
      }
      return;
    }

    if (action === 'list') {
      const { response } = await authFetch('/api/v1/companies/');
      if (response.status === 403) {
        const msg = redactSensitive(await readJsonErrorBody(response));
        console.error(
          pc.red(
            `Forbidden (HTTP 403). ${msg} ` +
              'Your token may lack membership for the selected tenant, or the wrong regional company is active.',
          ),
        );
        process.exitCode = 1;
        return;
      }
      if (!response.ok) {
        const msg = redactSensitive(await readJsonErrorBody(response));
        console.error(pc.red(formatHttpFailure(response.status, msg)));
        process.exitCode = 1;
        return;
      }
      const rows = await response.json().catch(() => null);
      if (jsonMode) {
        printCliJson(Array.isArray(rows) ? rows : rows);
        return;
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(pc.yellow('No companies returned for this account.'));
        return;
      }
      for (const row of rows) {
        if (row && typeof row === 'object' && 'id' in row) {
          const name = typeof row.name === 'string' ? row.name : '';
          console.log(`${row.id}\t${name}`);
        }
      }
      return;
    }

    if (action === 'get') {
      const id = typeof arg === 'string' && arg.trim() ? arg.trim() : '';
      if (!id || !/^\d+$/.test(id)) {
        console.error(pc.red('Pass a regional company id: shellui companies get <id>'));
        process.exitCode = 1;
        return;
      }
      const { response } = await authFetch(`/api/v1/companies/${encodeURIComponent(id)}/`);
      if (response.status === 403) {
        const msg = redactSensitive(await readJsonErrorBody(response));
        console.error(
          pc.red(
            `Forbidden (HTTP 403). ${msg} You may not be a member of company ${id}, or the token tenant does not match.`,
          ),
        );
        process.exitCode = 1;
        return;
      }
      if (!response.ok) {
        const msg = redactSensitive(await readJsonErrorBody(response));
        console.error(pc.red(formatHttpFailure(response.status, msg)));
        process.exitCode = 1;
        return;
      }
      const row = await response.json().catch(() => null);
      if (jsonMode) {
        printCliJson(row);
        return;
      }
      if (row && typeof row === 'object') {
        const name = typeof row.name === 'string' ? row.name : '';
        console.log(`${pc.bold('Regional id:')} ${row.id}`);
        console.log(`${pc.bold('Name:')}        ${name}`);
      }
      return;
    }

    console.error(pc.red(`Unknown companies action: ${action}`));
    process.exitCode = 1;
  } catch (err) {
    console.error(pc.red(cliErrorMessage(err)));
    process.exitCode = 1;
  }
}
