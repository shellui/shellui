import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import pc from 'picocolors';
import { buildCommand } from './build.js';
import { hostingFetch, hostingUpload, readHostingError } from '../hosting/client.js';
import {
  resolveHostingTarget,
  validateHostingTarget,
  deprecatedHostingAppWarning,
} from '../hosting/resolve-target.js';
import { loadConfig } from '../utils/index.js';
import { getWebDistDir, getProjectRoot } from '../utils/paths.js';

/** Matches hosting-service SemVer.parse (major.minor.patch[-prerelease]). */
const SHELLUI_VERSION_RE =
  /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<prerelease>[0-9A-Za-z.-]+))?$/;

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function readProjectVersion(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function normalizeShelluiVersion(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const match = SHELLUI_VERSION_RE.exec(raw);
  if (!match) return null;
  return raw.replace(/^v/, '');
}

/**
 * Resolve the installed @shellui/core package.json for this project.
 * Prefer the real installed version over dependency ranges (`workspace:*`, `^0.5.0`, …).
 * @param {string} projectRoot
 * @returns {string}
 */
function readShelluiCoreVersion(projectRoot) {
  /** @type {string[]} */
  const candidates = [];
  try {
    const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));
    candidates.push(requireFromProject.resolve('@shellui/core/package.json'));
  } catch {
    // Project may not resolve yet; try node_modules path below.
  }
  candidates.push(path.join(projectRoot, 'node_modules', '@shellui', 'core', 'package.json'));

  for (const pkgPath of candidates) {
    try {
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const version = normalizeShelluiVersion(pkg.version);
      if (version) return version;
    } catch {
      // try next candidate
    }
  }

  const projectPkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(projectPkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(projectPkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const declared = normalizeShelluiVersion(deps['@shellui/core']);
      if (declared) return declared;
    } catch {
      // fall through
    }
  }

  throw new Error(
    'Could not resolve shellui_version from installed @shellui/core. ' +
      'Install dependencies (so node_modules/@shellui/core exists) or pin a semver in package.json.',
  );
}

/**
 * @param {string} distDir
 * @returns {string} Path to tarball
 */
function createDistTarball(distDir) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-deploy-'));
  const tarballPath = path.join(tmpDir, 'artifact.tar.gz');
  execFileSync('tar', ['-czf', tarballPath, '-C', distDir, '.'], { stdio: 'pipe' });
  return tarballPath;
}

/**
 * @param {Record<string, unknown> | null | undefined} payload
 */
function printDeploymentResult(payload) {
  console.log(pc.green('Preview deploy complete.'));
  const slug = typeof payload?.slug === 'string' ? payload.slug : null;
  const urls =
    payload?.urls && typeof payload.urls === 'object'
      ? /** @type {{ url?: string }} */ (payload.urls)
      : null;
  if (urls?.url) {
    console.log(`${pc.bold('Browse:')}       ${urls.url}`);
  }
  if (slug) {
    console.log(`${pc.bold('Slug:')}          ${slug}`);
    console.log(
      pc.gray(
        `  Redeploy later: add ${pc.cyan(`"slug": "${slug}"`)} to hosting in shellui.config.json`,
      ),
    );
  }
  if (typeof payload?.expires_at === 'string' && payload.expires_at) {
    console.log(`${pc.bold('Expires:')}      ${payload.expires_at}`);
  }
  const deployment =
    payload?.deployment && typeof payload.deployment === 'object'
      ? /** @type {{ id?: string }} */ (payload.deployment)
      : null;
  if (deployment?.id) {
    console.log(`${pc.bold('Deployment:')}   ${deployment.id}`);
  }
}

/** @param {string} hostingUrl */
function baseApiUrl(hostingUrl) {
  return hostingUrl.replace(/\/$/, '');
}

/**
 * @param {string} root
 * @param {{
 *   build?: boolean,
 *   version?: string,
 *   slug?: string,
 *   app?: string,
 *   dryRun?: boolean,
 *   config?: string,
 * }} options
 */
export async function deployCommand(root = '.', options = {}) {
  const cwd = process.cwd();
  const projectRoot = getProjectRoot(root, cwd);
  const target = resolveHostingTarget({
    root,
    config: options.config,
    slug: options.slug ?? options.app,
  });
  const validationError = validateHostingTarget(target);
  if (validationError) {
    console.error(pc.red(validationError));
    process.exitCode = 1;
    return;
  }
  const deprecatedApp = deprecatedHostingAppWarning(root, { config: options.config });
  if (deprecatedApp) {
    console.warn(pc.yellow(deprecatedApp));
  }

  const distDir = getWebDistDir(root, cwd);

  let config;
  try {
    config = await loadConfig(root, { config: options.config });
  } catch (err) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
    return;
  }

  const appVersion =
    (typeof options.version === 'string' && options.version.trim()) ||
    (typeof config.version === 'string' && config.version.trim()) ||
    readProjectVersion(projectRoot);

  let shelluiVersion;
  try {
    shelluiVersion = readShelluiCoreVersion(projectRoot);
  } catch (err) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
    return;
  }

  const { hostingUrl, slug: configSlug } = target;

  if (options.dryRun) {
    console.log(pc.blue('Dry run — no changes will be made.'));
    console.log(`${pc.bold('Hosting:')}         ${hostingUrl}`);
    console.log(`${pc.bold('Slug:')}            ${configSlug || pc.gray('(new preview site)')}`);
    console.log(`${pc.bold('App version:')}      ${appVersion}`);
    console.log(`${pc.bold('Shellui version:')}  ${shelluiVersion}`);
    console.log(`${pc.bold('Artifact:')}        ${distDir} → artifact.tar.gz`);
    return;
  }

  /** @type {string | undefined} */
  let tarballPath;
  try {
    if (options.build || !fs.existsSync(distDir)) {
      if (!options.build && !fs.existsSync(distDir)) {
        console.log(pc.yellow('dist/web/ not found — running build...'));
      }
      await buildCommand(root, { config: options.config });
    }

    if (!fs.existsSync(distDir)) {
      throw new Error('dist/web/ does not exist. Run shellui build or pass --build.');
    }

    console.log(pc.blue('Preparing preview site...'));
    const { response: prepareResponse } = await hostingFetch(hostingUrl, '/hosting/v1/preview', {
      method: 'POST',
      body: {
        slug: configSlug || undefined,
        display_name: config.title || undefined,
        app_version: appVersion,
        shellui_version: shelluiVersion,
      },
    });
    if (!prepareResponse.ok) {
      throw new Error(
        `Failed to prepare preview (HTTP ${prepareResponse.status}): ${await readHostingError(prepareResponse)}`,
      );
    }
    const prepared = await prepareResponse.json();
    const siteSlug = typeof prepared?.slug === 'string' ? prepared.slug.trim() : '';
    const deploymentId = prepared?.deployment?.id;
    if (!siteSlug || !deploymentId) {
      throw new Error('Hosting returned an invalid preview payload.');
    }

    console.log(pc.blue('Creating deployment artifact...'));
    tarballPath = createDistTarball(distDir);
    const artifactSize = fs.statSync(tarballPath).size;
    console.log(pc.gray(`  Artifact size: ${(artifactSize / 1024).toFixed(1)} KB`));
    console.log(pc.gray(`  Site slug:     ${siteSlug}`));

    console.log(pc.blue('Uploading artifact...'));
    const artifactBytes = fs.readFileSync(tarballPath);
    const { response: uploadResponse } = await hostingUpload(
      hostingUrl,
      `/hosting/v1/apps/${encodeURIComponent(siteSlug)}/deployments/${deploymentId}/upload`,
      artifactBytes,
    );
    if (!uploadResponse.ok) {
      throw new Error(
        `Failed to upload artifact (HTTP ${uploadResponse.status}): ${await readHostingError(uploadResponse)}`,
      );
    }

    console.log(pc.blue('Finalizing deployment...'));
    const { response: finalizeResponse } = await hostingFetch(
      hostingUrl,
      `/hosting/v1/apps/${encodeURIComponent(siteSlug)}/deployments/${deploymentId}/finalize`,
      { method: 'POST' },
    );
    if (!finalizeResponse.ok) {
      throw new Error(
        `Failed to finalize deployment (HTTP ${finalizeResponse.status}): ${await readHostingError(finalizeResponse)}`,
      );
    }
    const finalized = await finalizeResponse.json();
    printDeploymentResult({
      slug: siteSlug,
      urls: finalized?.urls,
      expires_at: finalized?.expires_at,
      deployment: finalized,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Not logged in')) {
      console.error(pc.red(err.message));
    } else {
      console.error(pc.red(err instanceof Error ? err.message : String(err)));
    }
    process.exitCode = 1;
  } finally {
    if (tarballPath && fs.existsSync(tarballPath)) {
      try {
        fs.unlinkSync(tarballPath);
        fs.rmdirSync(path.dirname(tarballPath));
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

/**
 * @param {string} root
 * @param {{ slug?: string, app?: string, config?: string }} options
 */
export async function deployHistoryCommand(root = '.', options = {}) {
  const target = resolveHostingTarget({
    root,
    config: options.config,
    slug: options.slug ?? options.app,
  });
  const validationError = validateHostingTarget(target, { requireSlug: true });
  if (validationError) {
    console.error(pc.red(validationError));
    process.exitCode = 1;
    return;
  }

  const { hostingUrl, slug: siteSlug } = target;

  try {
    const { response } = await hostingFetch(
      hostingUrl,
      `/hosting/v1/apps/${encodeURIComponent(siteSlug)}/deployments`,
    );
    if (!response.ok) {
      console.error(
        pc.red(
          `Failed to load deployment history (HTTP ${response.status}): ${await readHostingError(response)}`,
        ),
      );
      process.exitCode = 1;
      return;
    }
    const deployments = await response.json();
    if (!Array.isArray(deployments) || deployments.length === 0) {
      console.log(pc.yellow('No deployments found.'));
      return;
    }

    console.log(`${pc.bold('Slug:')} ${siteSlug}\n`);
    for (const d of deployments) {
      const active = d.status === 'active' ? pc.green(' (active)') : '';
      const pinned = d.pinned ? pc.cyan(' [pinned]') : '';
      console.log(
        `${pc.dim(d.id)}  ${d.app_version}  shellui ${d.shellui_version}  ${d.status}${active}${pinned}`,
      );
      if (d.finalized_at) {
        console.log(pc.dim(`  finalized ${d.finalized_at}`));
      }
    }
  } catch (err) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  }
}

/**
 * @param {string} root
 * @param {{ slug?: string, app?: string, config?: string, to?: string, deployment?: string }} options
 */
export async function deployRollbackCommand(root = '.', options = {}) {
  const target = resolveHostingTarget({
    root,
    config: options.config,
    slug: options.slug ?? options.app,
  });
  const validationError = validateHostingTarget(target, { requireSlug: true });
  if (validationError) {
    console.error(pc.red(validationError));
    process.exitCode = 1;
    return;
  }

  const toVersion = typeof options.to === 'string' && options.to.trim() ? options.to.trim() : null;
  const deploymentId =
    typeof options.deployment === 'string' && options.deployment.trim()
      ? options.deployment.trim()
      : null;

  if (!toVersion && !deploymentId) {
    console.error(pc.red('Pass --to <version> or --deployment <uuid> to select a deployment.'));
    process.exitCode = 1;
    return;
  }

  const { hostingUrl, slug: siteSlug } = target;

  try {
    let rollbackId = deploymentId;
    if (!rollbackId && toVersion) {
      const { response: listResponse } = await hostingFetch(
        hostingUrl,
        `/hosting/v1/apps/${encodeURIComponent(siteSlug)}/deployments`,
      );
      if (!listResponse.ok) {
        throw new Error(
          `Failed to load deployments (HTTP ${listResponse.status}): ${await readHostingError(listResponse)}`,
        );
      }
      const deployments = await listResponse.json();
      const match = Array.isArray(deployments)
        ? deployments.find((d) => d.app_version === toVersion)
        : null;
      if (!match?.id) {
        console.error(pc.red(`No deployment found with app_version ${toVersion}.`));
        process.exitCode = 1;
        return;
      }
      rollbackId = match.id;
    }

    const { response } = await hostingFetch(
      hostingUrl,
      `/hosting/v1/apps/${encodeURIComponent(siteSlug)}/deployments/${rollbackId}/rollback`,
      { method: 'POST' },
    );
    if (!response.ok) {
      console.error(
        pc.red(`Rollback failed (HTTP ${response.status}): ${await readHostingError(response)}`),
      );
      process.exitCode = 1;
      return;
    }

    const deployment = await response.json();
    console.log(
      pc.green(`Rolled back to deployment ${deployment.id} (${deployment.app_version}).`),
    );
    printDeploymentResult({
      slug: siteSlug,
      urls: deployment?.urls,
      expires_at: deployment?.expires_at,
      deployment,
    });
  } catch (err) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  }
}
