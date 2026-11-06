import pc from 'picocolors';

import { useConfigAccount } from '../auth/resolve-target.js';
import { resolveCompanyScope } from '../cli-context/company-scope.js';
import {
  formatHttpFailure,
  readJsonErrorBody,
  regionalServiceFetch,
} from '../http/service-http.js';
import { cliErrorMessage, printCliJson } from './cli-output.js';
import { resolveStorageBaseUrl } from './service-resolve.js';

/**
 * @param {'list' | 'get' | 'create'} action
 * @param {string} [bucketName]
 * @param {{ root?: string, config?: string, company?: string, json?: boolean }} options
 */
export async function storageBucketsCommand(action, bucketName, options = {}) {
  useConfigAccount({ root: options.root ?? '.', config: options.config });
  const jsonMode = options.json === true;

  try {
    const { companyId } = resolveCompanyScope({
      root: options.root,
      config: options.config,
      company: options.company,
    });
    const baseUrl = resolveStorageBaseUrl({ root: options.root, config: options.config });
    if (!baseUrl) {
      console.error(
        pc.red(
          'Missing storage.url in shellui.config.json. Add storage.url or set it in shellui.storage.config.json.',
        ),
      );
      process.exitCode = 1;
      return;
    }

    if (action === 'list') {
      const { response } = await regionalServiceFetch(
        baseUrl,
        '/storage/v1/bucket',
        {},
        { companyId },
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
        console.log(pc.yellow('No buckets returned.'));
        return;
      }
      for (const row of rows) {
        if (row && typeof row === 'object') {
          const id = row.id != null ? String(row.id) : '';
          const name = typeof row.name === 'string' ? row.name : '';
          console.log([id, name].filter(Boolean).join('\t'));
        }
      }
      return;
    }

    if (action === 'create') {
      const { response } = await regionalServiceFetch(
        baseUrl,
        '/storage/v1/bucket',
        { method: 'POST', body: {} },
        { companyId },
      );
      const msg = await readJsonErrorBody(response);
      if (!response.ok) {
        if (jsonMode) {
          printCliJson({ ok: false, status: response.status, message: msg });
        } else {
          console.error(pc.red(formatHttpFailure(response.status, msg)));
        }
        process.exitCode = 1;
        return;
      }
      const row = await response.json().catch(() => null);
      if (jsonMode) {
        printCliJson(row);
      } else {
        console.log(pc.green('Bucket created.'));
        console.log(JSON.stringify(row, null, 2));
      }
      return;
    }

    if (action === 'get') {
      const name =
        typeof bucketName === 'string' && bucketName.trim() ? bucketName.trim() : 'company';
      const { response } = await regionalServiceFetch(
        baseUrl,
        `/storage/v1/bucket/${encodeURIComponent(name)}`,
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
      } else {
        console.log(JSON.stringify(row, null, 2));
      }
      return;
    }

    console.error(pc.red(`Unknown storage buckets action: ${action}`));
    process.exitCode = 1;
  } catch (err) {
    console.error(pc.red(cliErrorMessage(err)));
    process.exitCode = 1;
  }
}
