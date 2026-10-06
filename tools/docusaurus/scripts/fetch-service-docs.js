#!/usr/bin/env node
// @ts-check
/**
 * Collect each Shellui service's `docs/` folder for the main docs site.
 *
 * Local mode uses a sibling checkout (for example `../identity-service/docs`)
 * in place, so `docusaurus start` live reloads while you edit service docs.
 * Remote mode does a shallow, sparse, docs-only clone from GitHub into
 * `tools/docusaurus/.services/<id>/`.
 *
 * The result is written to `tools/docusaurus/.services/manifest.json`.
 * See `../services.js` for every environment variable.
 *
 * Usage: node scripts/fetch-service-docs.js [--source=auto|local|remote]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');
const {
  REPO_ROOT,
  SERVICES_DIR,
  MANIFEST_PATH,
  DEFAULT_SIDEBAR_PATH,
  serviceEnv,
  selectedServices,
} = require('../services');

const MODES = ['auto', 'local', 'remote'];

function log(message) {
  process.stdout.write(`[docs:fetch] ${message}\n`);
}

/** @param {string} value @param {string} origin */
function parseMode(value, origin) {
  const mode = (value || 'auto').trim().toLowerCase();
  if (!MODES.includes(mode)) {
    throw new Error(`${origin} must be one of ${MODES.join(', ')} (got "${value}")`);
  }
  return mode;
}

function cliSource() {
  const arg = process.argv.slice(2).find((value) => value.startsWith('--source='));
  return arg ? arg.slice('--source='.length) : undefined;
}

/** @param {string} dir */
function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** @param {string} file */
function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
function git(args, cwd) {
  const extra = [];
  const token = process.env.DOCS_GITHUB_TOKEN;
  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
    extra.push('-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`);
  }
  return execFileSync('git', [...extra, ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: {...process.env, GIT_TERMINAL_PROMPT: '0'},
  }).trim();
}

/**
 * Where a sibling checkout of the service would live.
 * @param {import('../services').ServiceDefinition} service
 */
function localCandidate(service) {
  const explicit = serviceEnv(service, 'PATH');
  if (explicit) {
    const docsPath = path.resolve(process.cwd(), explicit);
    return {docsPath, repoRoot: path.dirname(docsPath), explicit: true};
  }
  const parent = process.env.DOCS_SERVICES_DIR
    ? path.resolve(process.cwd(), process.env.DOCS_SERVICES_DIR)
    : path.dirname(REPO_ROOT);
  const repoRoot = path.join(parent, service.repo.split('/')[1]);
  return {docsPath: path.join(repoRoot, service.docsDir), repoRoot, explicit: false};
}

/**
 * @param {import('../services').ServiceDefinition} service
 * @param {{docsPath: string, repoRoot: string}} candidate
 */
function useLocal(service, candidate) {
  const docsPath = fs.realpathSync(candidate.docsPath);
  const repoRoot = path.dirname(docsPath);
  const localRoot = isDirectory(candidate.repoRoot) ? fs.realpathSync(candidate.repoRoot) : repoRoot;
  const sidebar = service.sidebarFiles
    .map((file) => path.join(localRoot, file))
    .find((file) => isFile(file));
  let commit = null;
  try {
    commit = git(['rev-parse', 'HEAD'], repoRoot);
  } catch {
    // Not a git checkout, which is fine for local mode.
  }
  return {
    mode: 'local',
    ref: null,
    commit,
    docsPath,
    repoRoot,
    sidebarPath: sidebar || null,
  };
}

/** @param {import('../services').ServiceDefinition} service */
function useRemote(service) {
  const repo = serviceEnv(service, 'REPO') || service.repo;
  const ref = serviceEnv(service, 'REF') || 'main';
  const url = `https://github.com/${repo}.git`;
  const target = path.join(SERVICES_DIR, service.id);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `shellui-docs-${service.id}-`));

  try {
    git(['init', '--quiet'], tmp);
    git(['remote', 'add', 'origin', url], tmp);
    const patterns = [`/${service.docsDir}/`, ...service.sidebarFiles.map((file) => `/${file}`)];
    git(['sparse-checkout', 'set', '--no-cone', ...patterns], tmp);
    // `git fetch <ref>` accepts branches, tags and commit SHAs, unlike `git clone --branch`.
    git(['fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', ref], tmp);
    git(['checkout', '--quiet', 'FETCH_HEAD'], tmp);
    const commit = git(['rev-parse', 'HEAD'], tmp);

    const fetchedDocs = path.join(tmp, service.docsDir);
    if (!isDirectory(fetchedDocs)) {
      throw new Error(`${repo}@${ref} has no ${service.docsDir}/ folder`);
    }

    fs.rmSync(target, {recursive: true, force: true});
    fs.mkdirSync(target, {recursive: true});
    fs.cpSync(fetchedDocs, path.join(target, 'docs'), {recursive: true});

    const fetchedSidebar = service.sidebarFiles
      .map((file) => path.join(tmp, file))
      .find((file) => isFile(file));
    let sidebarPath = null;
    if (fetchedSidebar) {
      sidebarPath = path.join(target, 'sidebars.js');
      fs.copyFileSync(fetchedSidebar, sidebarPath);
    }

    return {
      mode: 'remote',
      ref,
      commit,
      repo,
      docsPath: path.join(target, 'docs'),
      repoRoot: target,
      sidebarPath,
    };
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : '';
    throw new Error(
      `Could not fetch ${repo}@${ref}: ${stderr || (error instanceof Error ? error.message : error)}`,
    );
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

/**
 * @param {import('../services').ServiceDefinition} service
 * @param {string} globalMode
 */
function resolveService(service, globalMode) {
  const candidate = localCandidate(service);
  const perService = serviceEnv(service, 'SOURCE');
  let mode = perService
    ? parseMode(perService, `${service.id.toUpperCase()}_DOCS_SOURCE`)
    : globalMode;
  if (candidate.explicit) {
    mode = 'local';
  }

  const hasLocal = isDirectory(candidate.docsPath);
  if (mode === 'local' || (mode === 'auto' && hasLocal)) {
    if (!hasLocal) {
      throw new Error(
        `Local docs for ${service.id} not found at ${candidate.docsPath}. ` +
          `Clone ${service.repo} next to this repository, set ${service.id.toUpperCase()}_DOCS_PATH, ` +
          'or use DOCS_SOURCE=remote.',
      );
    }
    return useLocal(service, candidate);
  }
  return useRemote(service);
}

function main() {
  const globalMode = parseMode(cliSource() || process.env.DOCS_SOURCE || 'auto', 'DOCS_SOURCE');
  const allowMissing = ['1', 'true', 'yes'].includes(
    String(process.env.DOCS_ALLOW_MISSING || '').toLowerCase(),
  );
  const services = selectedServices();

  fs.mkdirSync(SERVICES_DIR, {recursive: true});
  log(`source: ${globalMode}`);

  const entries = [];
  const failures = [];
  for (const service of services) {
    try {
      const resolved = resolveService(service, globalMode);
      const sidebarPath = resolved.sidebarPath || DEFAULT_SIDEBAR_PATH;
      const where =
        resolved.mode === 'local'
          ? resolved.docsPath
          : `${resolved.repo}@${resolved.ref} (${String(resolved.commit).slice(0, 7)})`;
      log(
        `${service.id}: ${resolved.mode} ${where}${resolved.sidebarPath ? '' : ' (default sidebar)'}`,
      );
      if (resolved.mode === 'local') {
        // Drop a remote copy left by an earlier run so only one source exists.
        fs.rmSync(path.join(SERVICES_DIR, service.id), {recursive: true, force: true});
      }
      entries.push({
        id: service.id,
        label: service.label,
        repo: resolved.repo || serviceEnv(service, 'REPO') || service.repo,
        routeBasePath: service.routeBasePath,
        legacyHost: service.legacyHost,
        mode: resolved.mode,
        ref: resolved.ref,
        commit: resolved.commit,
        docsPath: resolved.docsPath,
        repoRoot: resolved.repoRoot,
        sidebarPath,
        ownSidebar: Boolean(resolved.sidebarPath),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${service.id}: ${message}`);
      fs.rmSync(path.join(SERVICES_DIR, service.id), {recursive: true, force: true});
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: globalMode,
    services: entries,
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  if (failures.length > 0) {
    const text = failures.map((line) => `  - ${line}`).join('\n');
    if (!allowMissing) {
      fs.rmSync(MANIFEST_PATH, {force: true});
      process.stderr.write(
        `[docs:fetch] failed:\n${text}\nSet DOCS_ALLOW_MISSING=1 to build without these services.\n`,
      );
      process.exit(1);
    }
    process.stderr.write(`[docs:fetch] skipped (DOCS_ALLOW_MISSING=1):\n${text}\n`);
  }
  log(`wrote ${path.relative(REPO_ROOT, MANIFEST_PATH)}`);
}

main();
