import pc from 'picocolors';

import { resolveAuthTarget, useConfigAccount } from '../auth/resolve-target.js';
import {
  resolveDashboardCompanyUuidFromSession,
  validateDashboardCompanyUuid,
} from '../cli-context/company-scope.js';
import { writeCliDashboardSessionFile } from '../cli-context/session-file.js';
import { dashboardServiceFetch } from '../http/dashboard-http.js';
import { formatHttpFailure, readJsonErrorBody, redactSensitive } from '../http/service-http.js';
import { saasApiV1Path, saasDashboardPath } from '../http/saas-paths.js';
import { cliErrorMessage, printCliJson } from './cli-output.js';
import { resolveSaasBaseUrl } from './service-resolve.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * SaaS dashboard global companies (UUID ids) and related api/v1 routes on the same host.
 * Not regional identity `GET /api/v1/companies` (integer id). Does not send `company_id` query.
 *
 * @param {'list' | 'get' | 'create' | 'use' | 'regions' | 'endpoints'} action
 * @param {string} [arg]
 * @param {{ root?: string, config?: string, json?: boolean }} options
 */
export async function projectsCommand(action, arg, options = {}) {
  useConfigAccount({ root: options.root ?? '.', config: options.config });
  const jsonMode = options.json === true;

  if (action === 'create') {
    const msg =
      'Creating a dashboard company from the CLI is not implemented. Use the global dashboard ' +
      'UI or the SaaS global MCP agent (OAuth) when your policy allows provisioning. ' +
      'Read-only commands: shellui projects list, get, regions, endpoints; shellui projects use <uuid>.';
    if (jsonMode) {
      printCliJson({
        error: 'not_implemented',
        message: msg,
        hint: 'Global MCP OAuth path for writes when enabled for your account',
      });
    } else {
      console.error(pc.yellow(msg));
    }
    process.exitCode = 1;
    return;
  }

  try {
    const baseUrl = resolveSaasBaseUrl({ root: options.root, config: options.config });

    if (action === 'use') {
      const id = typeof arg === 'string' && arg.trim() ? arg.trim() : '';
      if (!id || !UUID_RE.test(id)) {
        console.error(pc.red('Pass a dashboard company UUID: shellui projects use <uuid>'));
        process.exitCode = 1;
        return;
      }
      const uuid = validateDashboardCompanyUuid(id);
      const target = resolveAuthTarget({ root: options.root ?? '.', config: options.config });
      if (!target.backendUrl || !target.configDir) {
        console.error(
          pc.red('Need shellui.config.json with backend.url to pin a default dashboard company.'),
        );
        process.exitCode = 1;
        return;
      }
      writeCliDashboardSessionFile({ backendUrl: target.backendUrl, dashboardCompanyUuid: uuid });
      if (jsonMode) {
        printCliJson({ ok: true, dashboardCompanyUuid: uuid, backendUrl: target.backendUrl });
      } else {
        console.log(
          pc.green(
            `Default dashboard company UUID saved for endpoints and other SaaS paths (identity ${target.backendUrl}).`,
          ),
        );
        console.log(
          pc.dim(
            'Regional tenant id stays in backend.companyId and shellui companies use (decimal).',
          ),
        );
      }
      return;
    }

    if (action === 'list') {
      const { response } = await dashboardServiceFetch(
        baseUrl,
        `${saasDashboardPath('companies/')}`,
      );
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
        console.log(pc.yellow('No dashboard companies returned.'));
        return;
      }
      for (const row of rows) {
        if (row && typeof row === 'object') {
          const id = row.id != null ? String(row.id) : '';
          const name = typeof row.name === 'string' ? row.name : '';
          const slug = typeof row.slug === 'string' ? row.slug : '';
          console.log([id, slug, name].filter(Boolean).join('\t'));
        }
      }
      return;
    }

    if (action === 'get') {
      const id = typeof arg === 'string' && arg.trim() ? arg.trim() : '';
      if (!id) {
        console.error(pc.red('Pass a dashboard company UUID: shellui projects get <uuid>'));
        process.exitCode = 1;
        return;
      }
      if (!UUID_RE.test(id)) {
        console.error(
          pc.red(
            'Dashboard company ids are UUIDs. Regional tenant ids are decimal (shellui companies list).',
          ),
        );
        process.exitCode = 1;
        return;
      }

      const { response } = await dashboardServiceFetch(
        baseUrl,
        `${saasDashboardPath(`companies/${encodeURIComponent(id)}/`)}`,
      );
      if (response.status === 404) {
        const msg = await readJsonErrorBody(response);
        console.error(pc.red(`Not found (HTTP 404). ${redactSensitive(msg)}`));
        process.exitCode = 1;
        return;
      }
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
        console.log(JSON.stringify(row, null, 2));
      }
      return;
    }

    if (action === 'regions') {
      const { response } = await dashboardServiceFetch(baseUrl, `${saasApiV1Path('regions/')}`);
      if (!response.ok) {
        const msg = await readJsonErrorBody(response);
        console.error(pc.red(formatHttpFailure(response.status, msg)));
        process.exitCode = 1;
        return;
      }
      const rows = await response.json().catch(() => null);
      if (jsonMode) {
        printCliJson(rows);
      } else {
        console.log(JSON.stringify(rows, null, 2));
      }
      return;
    }

    if (action === 'endpoints') {
      let uuid =
        typeof arg === 'string' && arg.trim() ? validateDashboardCompanyUuid(arg.trim()) : '';
      if (!uuid) {
        const fromSession = resolveDashboardCompanyUuidFromSession({
          root: options.root,
          config: options.config,
        });
        if (fromSession) uuid = fromSession;
      }
      if (!uuid) {
        console.error(
          pc.red(
            'Pass a dashboard company UUID or run shellui projects use <uuid> first: shellui projects endpoints <uuid>',
          ),
        );
        process.exitCode = 1;
        return;
      }
      const { response } = await dashboardServiceFetch(
        baseUrl,
        `${saasApiV1Path(`companies/${encodeURIComponent(uuid)}/endpoints/`)}`,
      );
      if (response.status === 404) {
        const msg = await readJsonErrorBody(response);
        console.error(pc.red(`Not found (HTTP 404). ${redactSensitive(msg)}`));
        process.exitCode = 1;
        return;
      }
      if (!response.ok) {
        const msg = await readJsonErrorBody(response);
        console.error(pc.red(formatHttpFailure(response.status, msg)));
        process.exitCode = 1;
        return;
      }
      const rows = await response.json().catch(() => null);
      if (jsonMode) {
        printCliJson(rows);
      } else {
        console.log(JSON.stringify(rows, null, 2));
      }
      return;
    }

    console.error(pc.red(`Unknown projects action: ${action}`));
    process.exitCode = 1;
  } catch (err) {
    const raw = cliErrorMessage(err);
    const safe = redactSensitive(raw);
    if (/fetch failed|network/i.test(safe) || err instanceof TypeError) {
      console.error(pc.red(`Request failed (network). ${safe}`));
    } else {
      console.error(pc.red(safe));
    }
    process.exitCode = 1;
  }
}
