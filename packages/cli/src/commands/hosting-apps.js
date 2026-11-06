import pc from 'picocolors';

import { useConfigAccount } from '../auth/resolve-target.js';
import { resolveCompanyScope } from '../cli-context/company-scope.js';
import {
  formatHttpFailure,
  readJsonErrorBody,
  regionalServiceFetch,
} from '../http/service-http.js';
import { cliErrorMessage, printCliJson } from './cli-output.js';
import { resolveHostingBaseUrl } from './service-resolve.js';

/**
 * @param {'list' | 'get'} action
 * @param {string} [ref]
 * @param {{ root?: string, config?: string, company?: string, json?: boolean }} options
 */
export async function hostingAppsCommand(action, ref, options = {}) {
  useConfigAccount({ root: options.root ?? '.', config: options.config });
  const jsonMode = options.json === true;

  try {
    resolveCompanyScope({
      root: options.root,
      config: options.config,
      company: options.company,
    });
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

    if (action === 'list') {
      const { response } = await regionalServiceFetch(
        baseUrl,
        '/hosting/v1/apps',
        {},
        { companyId: null },
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
        console.log(pc.yellow('No hosted apps returned.'));
        return;
      }
      for (const app of rows) {
        if (app && typeof app === 'object') {
          const slug = typeof app.slug === 'string' ? app.slug : '';
          const display = typeof app.display_name === 'string' ? app.display_name : '';
          const urls =
            app.urls && typeof app.urls === 'object'
              ? /** @type {{ url?: string }} */ (app.urls)
              : null;
          const url = urls?.url ? ` ${urls.url}` : '';
          console.log(`${slug}\t${display}${url}`);
        }
      }
      return;
    }

    if (action === 'get') {
      const slug = typeof ref === 'string' && ref.trim() ? ref.trim() : '';
      if (!slug) {
        console.error(pc.red('Pass a site slug: shellui hosting apps get <slug>'));
        process.exitCode = 1;
        return;
      }
      const { response } = await regionalServiceFetch(
        baseUrl,
        `/hosting/v1/apps/${encodeURIComponent(slug)}`,
        {},
        { companyId: null },
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
        console.log(JSON.stringify(row, null, 2));
      }
      return;
    }

    console.error(pc.red(`Unknown hosting apps action: ${action}`));
    process.exitCode = 1;
  } catch (err) {
    console.error(pc.red(cliErrorMessage(err)));
    process.exitCode = 1;
  }
}
