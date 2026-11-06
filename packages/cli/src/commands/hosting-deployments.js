import pc from 'picocolors';

import { useConfigAccount } from '../auth/resolve-target.js';
import {
  formatHttpFailure,
  readJsonErrorBody,
  regionalServiceFetch,
} from '../http/service-http.js';
import { cliErrorMessage, printCliJson } from './cli-output.js';
import { resolveHostingBaseUrl, resolveHostingSlugFromConfig } from './service-resolve.js';

/**
 * There is no per-deployment GET; `status` loads the list and finds the UUID.
 *
 * @param {'list' | 'status'} action
 * @param {string} [arg]
 * @param {{ root?: string, config?: string, json?: boolean, slug?: string }} options
 */
export async function hostingDeploymentsCommand(action, arg, options = {}) {
  useConfigAccount({ root: options.root ?? '.', config: options.config });
  const jsonMode = options.json === true;

  try {
    const baseUrl = resolveHostingBaseUrl({ root: options.root, config: options.config });
    if (!baseUrl) {
      console.error(
        pc.red(
          'Missing hosting.url in shellui.config.json. Add hosting.url or shellui.hosting.config.json.',
        ),
      );
      process.exitCode = 1;
      return;
    }

    let slug =
      (typeof options.slug === 'string' && options.slug.trim() ? options.slug.trim() : '') ||
      (typeof arg === 'string' && action === 'list' && arg.trim() ? arg.trim() : '') ||
      '';
    if (!slug) {
      slug = resolveHostingSlugFromConfig({ root: options.root, config: options.config }) || '';
    }
    if (!slug) {
      console.error(
        pc.red('Pass a site slug (preview slug), or set hosting.slug in config, or use --slug.'),
      );
      process.exitCode = 1;
      return;
    }

    if (action === 'list') {
      const { response } = await regionalServiceFetch(
        baseUrl,
        `/hosting/v1/apps/${encodeURIComponent(slug)}/deployments`,
        {},
        { companyId: null, omitCompanyQuery: true },
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
        console.log(pc.yellow('No deployments found.'));
        return;
      }
      console.log(`${pc.bold('Slug:')} ${slug}\n`);
      for (const d of rows) {
        if (d && typeof d === 'object') {
          const active = d.status === 'active' ? pc.green(' (active)') : '';
          const pinned = d.pinned ? pc.cyan(' [pinned]') : '';
          console.log(
            `${pc.dim(String(d.id))}  ${d.app_version}  shellui ${d.shellui_version}  ${d.status}${active}${pinned}`,
          );
          if (d.finalized_at) {
            console.log(pc.dim(`  finalized ${d.finalized_at}`));
          }
        }
      }
      return;
    }

    if (action === 'status') {
      const depId = typeof arg === 'string' && arg.trim() ? arg.trim() : '';
      if (!depId) {
        console.error(
          pc.red('Pass a deployment UUID: shellui hosting deployments status <uuid> --slug <site>'),
        );
        process.exitCode = 1;
        return;
      }
      const { response } = await regionalServiceFetch(
        baseUrl,
        `/hosting/v1/apps/${encodeURIComponent(slug)}/deployments`,
        {},
        { companyId: null, omitCompanyQuery: true },
      );
      if (!response.ok) {
        const msg = await readJsonErrorBody(response);
        console.error(pc.red(formatHttpFailure(response.status, msg)));
        process.exitCode = 1;
        return;
      }
      const rows = await response.json().catch(() => null);
      const list = Array.isArray(rows) ? rows : [];
      const match = list.find((d) => d && typeof d === 'object' && String(d.id) === depId);
      if (!match) {
        console.error(pc.red(`Deployment ${depId} not found under slug ${slug}.`));
        process.exitCode = 1;
        return;
      }
      if (jsonMode) {
        printCliJson(match);
      } else {
        console.log(`${pc.bold('Slug:')}         ${slug}`);
        console.log(`${pc.bold('Deployment:')}   ${match.id}`);
        console.log(`${pc.bold('Status:')}       ${match.status}`);
        console.log(`${pc.bold('App version:')} ${match.app_version}`);
        console.log(`${pc.bold('Shellui:')}      ${match.shellui_version}`);
        if (match.urls && typeof match.urls === 'object') {
          const u = /** @type {{ url?: string }} */ (match.urls);
          if (u.url) console.log(`${pc.bold('URL:')}          ${u.url}`);
        }
        if (match.finalized_at) {
          console.log(`${pc.bold('Finalized:')}    ${match.finalized_at}`);
        }
      }
      return;
    }

    console.error(pc.red(`Unknown hosting deployments action: ${action}`));
    process.exitCode = 1;
  } catch (err) {
    console.error(pc.red(cliErrorMessage(err)));
    process.exitCode = 1;
  }
}
