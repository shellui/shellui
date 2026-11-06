import pc from 'picocolors';

import { useConfigAccount } from '../auth/resolve-target.js';
import { resolveCompanyScope } from '../cli-context/company-scope.js';
import {
  formatHttpFailure,
  readJsonErrorBody,
  regionalServiceFetch,
} from '../http/service-http.js';
import { cliErrorMessage, printCliJson } from './cli-output.js';
import { resolveSaasBaseUrl } from './service-resolve.js';

const PROJECTS_PATH = '/api/v1/projects/';

/**
 * @param {'list' | 'get' | 'create'} action
 * @param {string} [arg]
 * @param {{
 *   root?: string,
 *   config?: string,
 *   company?: string,
 *   json?: boolean,
 *   region?: string,
 *   name?: string,
 *   slug?: string,
 *   dryRun?: boolean,
 * }} options
 */
export async function projectsCommand(action, arg, options = {}) {
  useConfigAccount({ root: options.root ?? '.', config: options.config });
  const jsonMode = options.json === true;

  try {
    const { companyId } = resolveCompanyScope({
      root: options.root,
      config: options.config,
      company: options.company,
    });
    const baseUrl = resolveSaasBaseUrl({ root: options.root, config: options.config });

    if (action === 'list') {
      const { response } = await regionalServiceFetch(baseUrl, PROJECTS_PATH, {}, { companyId });
      if (!response.ok) {
        const msg = await readJsonErrorBody(response);
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
        console.log(pc.yellow('No projects returned.'));
        return;
      }
      for (const row of rows) {
        if (row && typeof row === 'object') {
          const id = row.id != null ? String(row.id) : '';
          const name = typeof row.name === 'string' ? row.name : '';
          const slug = typeof row.slug === 'string' ? row.slug : '';
          const region = typeof row.region === 'string' ? row.region : '';
          console.log([id, slug, name, region].filter(Boolean).join('\t'));
        }
      }
      return;
    }

    if (action === 'get') {
      const id = typeof arg === 'string' && arg.trim() ? arg.trim() : '';
      if (!id) {
        console.error(pc.red('Pass a project id: shellui projects get <id>'));
        process.exitCode = 1;
        return;
      }
      const { response } = await regionalServiceFetch(
        baseUrl,
        `${PROJECTS_PATH}${encodeURIComponent(id)}/`,
        {},
        { companyId },
      );
      if (!response.ok) {
        const msg = await readJsonErrorBody(response);
        console.error(pc.red(formatHttpFailure(response.status, msg)));
        process.exitCode = 1;
        return;
      }
      const row = await response.json().catch(() => null);
      if (jsonMode) {
        printCliJson(row);
        return;
      }
      console.log(JSON.stringify(row, null, 2));
      return;
    }

    if (action === 'create') {
      const name =
        typeof options.name === 'string' && options.name.trim() ? options.name.trim() : '';
      const slug =
        typeof options.slug === 'string' && options.slug.trim() ? options.slug.trim() : '';
      const region =
        typeof options.region === 'string' && options.region.trim() ? options.region.trim() : '';
      if (!name || !slug || !region) {
        console.error(pc.red('Create requires --name, --slug, and --region.'));
        process.exitCode = 1;
        return;
      }
      if (options.dryRun) {
        const plan = { companyId, saasUrl: baseUrl, name, slug, region };
        if (jsonMode) {
          printCliJson({ dryRun: true, ...plan });
        } else {
          console.log(pc.blue('Dry run (no request sent).'));
          for (const [k, v] of Object.entries(plan)) {
            console.log(`${pc.bold(k)}: ${v}`);
          }
        }
        return;
      }

      const { response } = await regionalServiceFetch(
        baseUrl,
        PROJECTS_PATH,
        { method: 'POST', body: { name, slug, region } },
        { companyId },
      );
      if (!response.ok) {
        const msg = await readJsonErrorBody(response);
        console.error(pc.red(formatHttpFailure(response.status, msg)));
        process.exitCode = 1;
        return;
      }
      const row = await response.json().catch(() => null);
      if (jsonMode) {
        printCliJson(row);
      } else {
        console.log(pc.green('Project created.'));
        console.log(JSON.stringify(row, null, 2));
      }
      return;
    }

    console.error(pc.red(`Unknown projects action: ${action}`));
    process.exitCode = 1;
  } catch (err) {
    console.error(pc.red(cliErrorMessage(err)));
    process.exitCode = 1;
  }
}
