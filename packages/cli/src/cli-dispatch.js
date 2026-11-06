import { popOptionalRoot, unknownNestedCommand } from './cli-nested-commands.js';
import { authStatusCommand } from './commands/auth-status.js';
import { hostingAppsCommand } from './commands/hosting-apps.js';
import { hostingDeploymentsCommand } from './commands/hosting-deployments.js';
import { projectsCommand } from './commands/projects.js';
import { storageBucketsCommand } from './commands/storage-buckets.js';

/**
 * @param {string[]} argvTokens
 * @param {{ config?: string, json?: boolean, company?: string, slug?: string }} options
 */
export async function dispatchVariadicCli(argvTokens, options = {}) {
  const { rest: tokens, root } = popOptionalRoot(argvTokens);
  const base = { ...options, root };

  if (tokens.length === 0) {
    console.error(unknownNestedCommand('command', ''));
    process.exitCode = 1;
    return;
  }

  const head = tokens[0];
  const tail = tokens.slice(1);

  if (head === 'auth') {
    if (tail.length === 1 && tail[0] === 'status') {
      await authStatusCommand(root, base);
      return;
    }
    console.error(unknownNestedCommand('auth', tail.join(' ') || 'missing status'));
    process.exitCode = 1;
    return;
  }

  if (head === 'storage' && tail[0] === 'buckets') {
    const sub = tail.slice(1);
    if (sub.length === 0) {
      console.error(unknownNestedCommand('storage buckets', 'missing action (list | get)'));
      process.exitCode = 1;
      return;
    }
    const action = sub[0];
    const after = sub.slice(1);
    if (action === 'list') {
      const { rest: extra, root: r2 } = popOptionalRoot(after);
      if (extra.length > 0) {
        console.error(unknownNestedCommand('storage buckets list', sub.join(' ')));
        process.exitCode = 1;
        return;
      }
      await storageBucketsCommand('list', undefined, { ...base, root: r2 });
      return;
    }
    if (action === 'get') {
      const { rest: nameRest, root: r2 } = popOptionalRoot(after);
      if (nameRest.length > 1) {
        console.error(unknownNestedCommand('storage buckets get', sub.join(' ')));
        process.exitCode = 1;
        return;
      }
      const bucketName = nameRest[0];
      await storageBucketsCommand('get', bucketName, { ...base, root: r2 });
      return;
    }
    console.error(unknownNestedCommand('storage buckets', sub.join(' ')));
    process.exitCode = 1;
    return;
  }

  if (head === 'storage') {
    console.error(unknownNestedCommand('storage', tail.join(' ') || 'missing buckets'));
    process.exitCode = 1;
    return;
  }

  if (head === 'hosting' && tail[0] === 'apps') {
    const sub = tail.slice(1);
    if (sub.length === 0) {
      console.error(unknownNestedCommand('hosting apps', 'missing action (list | get)'));
      process.exitCode = 1;
      return;
    }
    const action = sub[0];
    const after = sub.slice(1);
    if (action === 'list') {
      const { rest: extra, root: r2 } = popOptionalRoot(after);
      if (extra.length > 0) {
        console.error(unknownNestedCommand('hosting apps list', sub.join(' ')));
        process.exitCode = 1;
        return;
      }
      await hostingAppsCommand('list', undefined, { ...base, root: r2 });
      return;
    }
    if (action === 'get') {
      const { rest: refRest, root: r2 } = popOptionalRoot(after);
      if (refRest.length !== 1) {
        console.error(
          unknownNestedCommand(
            'hosting apps get',
            refRest.length === 0 ? 'missing slug' : refRest.join(' '),
          ),
        );
        process.exitCode = 1;
        return;
      }
      await hostingAppsCommand('get', refRest[0], { ...base, root: r2 });
      return;
    }
    console.error(unknownNestedCommand('hosting apps', sub.join(' ')));
    process.exitCode = 1;
    return;
  }

  if (head === 'hosting' && tail[0] === 'deployments') {
    const sub = tail.slice(1);
    if (sub.length === 0) {
      console.error(unknownNestedCommand('hosting deployments', 'missing list | status and args'));
      process.exitCode = 1;
      return;
    }
    const depAction = sub[0];
    const after = sub.slice(1);

    if (depAction === 'list') {
      const { rest: pos, root: r2 } = popOptionalRoot(after);
      if (pos.length > 0) {
        console.error(unknownNestedCommand('hosting deployments list', sub.join(' ')));
        process.exitCode = 1;
        return;
      }
      await hostingDeploymentsCommand('list', undefined, { ...base, root: r2 });
      return;
    }

    if (depAction === 'status') {
      const { rest: pos, root: r2 } = popOptionalRoot(after);
      if (pos.length !== 1) {
        console.error(
          unknownNestedCommand(
            'hosting deployments status',
            pos.length === 0 ? 'missing uuid' : pos.join(' '),
          ),
        );
        process.exitCode = 1;
        return;
      }
      await hostingDeploymentsCommand('status', pos[0], { ...base, root: r2 });
      return;
    }

    console.error(unknownNestedCommand('hosting deployments', sub.join(' ')));
    process.exitCode = 1;
    return;
  }

  if (head === 'hosting') {
    console.error(unknownNestedCommand('hosting', tail.join(' ') || 'missing apps | deployments'));
    process.exitCode = 1;
    return;
  }

  if (head === 'projects') {
    const sub = tail;
    if (sub.length === 0) {
      console.error(
        unknownNestedCommand(
          'projects',
          'missing action (list | get | use | regions | endpoints | create)',
        ),
      );
      process.exitCode = 1;
      return;
    }
    const action = sub[0];
    const after = sub.slice(1);
    const { rest: idRest, root: r2 } = popOptionalRoot(after);
    if (idRest.length > 1) {
      console.error(unknownNestedCommand('projects', tail.join(' ')));
      process.exitCode = 1;
      return;
    }
    const id = idRest[0];
    await projectsCommand(
      /** @type {'list' | 'get' | 'create' | 'use' | 'regions' | 'endpoints'} */ (action),
      id,
      { ...base, root: r2 },
    );
    return;
  }

  console.error(unknownNestedCommand('command', argvTokens.join(' ')));
  process.exitCode = 1;
}
