import pc from 'picocolors';

import { resolveAuthTarget, useConfigAccount } from '../auth/resolve-target.js';
import { authFetch } from '../auth/session.js';
import { writeCliSessionFile } from '../cli-context/session-file.js';
import { cliErrorMessage, printCliJson } from './cli-output.js';

/**
 * @param {'list' | 'get' | 'use'} action
 * @param {string} [arg]
 * @param {{ root?: string, config?: string, company?: string, json?: boolean }} options
 */
export async function companiesCommand(action, arg, options = {}) {
  useConfigAccount({ root: options.root ?? '.', config: options.config });
  const jsonMode = options.json === true;

  try {
    if (action === 'use') {
      const id = typeof arg === 'string' && arg.trim() ? arg.trim() : '';
      if (!id || !/^\d+$/.test(id)) {
        console.error(pc.red('Pass a numeric company id: shellui companies use <id>'));
        process.exitCode = 1;
        return;
      }
      const target = resolveAuthTarget({ root: options.root ?? '.', config: options.config });
      if (!target.backendUrl || !target.configDir) {
        console.error(
          pc.red(
            'Need shellui.config.json with backend.url (and type shellui) to pin a default company.',
          ),
        );
        process.exitCode = 1;
        return;
      }
      writeCliSessionFile({ backendUrl: target.backendUrl, defaultCompanyId: id });
      if (jsonMode) {
        printCliJson({ ok: true, defaultCompanyId: id, backendUrl: target.backendUrl });
      } else {
        console.log(pc.green(`Default CLI company set to ${id} (identity ${target.backendUrl}).`));
      }
      return;
    }

    if (action === 'list') {
      const { response } = await authFetch('/api/v1/companies/');
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error(
          pc.red(`Failed to list companies (HTTP ${response.status}). ${text.slice(0, 200)}`),
        );
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
        console.error(pc.red('Pass a numeric company id: shellui companies get <id>'));
        process.exitCode = 1;
        return;
      }
      const { response } = await authFetch(`/api/v1/companies/${encodeURIComponent(id)}/`);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error(
          pc.red(`Failed to load company (HTTP ${response.status}). ${text.slice(0, 200)}`),
        );
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
        console.log(`${pc.bold('Id:')}   ${row.id}`);
        console.log(`${pc.bold('Name:')} ${name}`);
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
