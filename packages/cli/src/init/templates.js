import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TEMPLATE_FILES, getFramework } from './registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Candidate local monorepo template directories (dev / unpublished CLI).
 * @param {string} framework
 * @param {{ cwd?: string, cliPackageRoot?: string }} [opts]
 * @returns {string[]}
 */
export function getLocalTemplateCandidates(framework, opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const cliPackageRoot = opts.cliPackageRoot ?? path.resolve(__dirname, '../..');
  return [
    path.join(cliPackageRoot, 'templates', framework),
    path.join(cwd, 'packages/cli/templates', framework),
    path.join(cwd, 'templates', framework),
  ];
}

/**
 * Resolve a local template directory if one exists.
 * @param {string} framework
 * @param {{ cwd?: string, cliPackageRoot?: string }} [opts]
 * @returns {string | null}
 */
export function resolveLocalTemplatePath(framework, opts = {}) {
  for (const candidate of getLocalTemplateCandidates(framework, opts)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Copy directory recursively.
 * @param {string} src
 * @param {string} dest
 */
export function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Build the GitHub raw content base URL for a framework template.
 * @param {string} framework
 * @param {string} ref - tag (e.g. v0.5.0-beta.2) or branch (main)
 */
export function buildTemplateBaseUrl(framework, ref) {
  return `https://raw.githubusercontent.com/shellui/shellui/${ref}/packages/cli/templates/${framework}`;
}

/**
 * @param {string} cliVersion
 * @returns {string} tag name including leading v
 */
export function cliVersionToTag(cliVersion) {
  return cliVersion.startsWith('v') ? cliVersion : `v${cliVersion}`;
}

const BINARY_TEMPLATE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isBinaryTemplateFile(filePath) {
  return BINARY_TEMPLATE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Fetch template files from a raw.githubusercontent.com base URL.
 * @param {string} baseUrl
 * @param {string} targetDir
 * @param {string} framework
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ ok: boolean, fetched: string[], missing: string[] }>}
 */
export async function fetchTemplateFiles(baseUrl, targetDir, framework, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const files = TEMPLATE_FILES[framework] || [];
  const fetched = [];
  const missing = [];

  for (const file of files) {
    const fileUrl = `${baseUrl}/${file}`;
    try {
      const response = await fetchImpl(fileUrl);
      if (!response.ok) {
        missing.push(file);
        continue;
      }
      const targetPath = path.join(targetDir, file);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (isBinaryTemplateFile(file)) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(targetPath, buffer);
      } else {
        const content = await response.text();
        fs.writeFileSync(targetPath, content, 'utf-8');
      }
      fetched.push(file);
    } catch {
      missing.push(file);
    }
  }

  return { ok: fetched.length > 0, fetched, missing };
}

/**
 * Resolve a framework template into targetDir.
 * Order: local monorepo copy → GitHub tag matching CLI version → main → clear error.
 *
 * @param {string} framework
 * @param {string} targetDir
 * @param {string} cliVersion
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   cwd?: string,
 *   cliPackageRoot?: string,
 *   onInfo?: (message: string) => void,
 * }} [opts]
 * @returns {Promise<{ source: 'local' | 'github-tag' | 'github-main', path?: string, ref?: string }>}
 */
export async function resolveFrameworkTemplate(framework, targetDir, cliVersion, opts = {}) {
  const onInfo = opts.onInfo ?? (() => {});
  const frameworkDef = getFramework(framework);
  if (!frameworkDef || frameworkDef.scaffold !== 'fetch') {
    throw new Error(`Framework "${framework}" does not support template fetch`);
  }

  const localPath = resolveLocalTemplatePath(framework, {
    cwd: opts.cwd,
    cliPackageRoot: opts.cliPackageRoot,
  });
  if (localPath) {
    onInfo(`Using local template: ${localPath}`);
    copyDir(localPath, targetDir);
    return { source: 'local', path: localPath };
  }

  const tagName = cliVersionToTag(cliVersion);
  const tagBaseUrl = buildTemplateBaseUrl(framework, tagName);
  onInfo(`Fetching ${framework} template from GitHub (${tagName})...`);

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  try {
    const manifestResponse = await fetchImpl(`${tagBaseUrl}/package.json`);
    if (manifestResponse.ok) {
      const result = await fetchTemplateFiles(tagBaseUrl, targetDir, framework, { fetchImpl });
      if (!result.ok) {
        throw new Error(
          `Failed to fetch ${framework} template files from ${tagName} (no files downloaded)`,
        );
      }
      return { source: 'github-tag', ref: tagName };
    }

    onInfo(`Tag ${tagName} not found, trying main branch...`);
    const mainBaseUrl = buildTemplateBaseUrl(framework, 'main');
    const mainManifest = await fetchImpl(`${mainBaseUrl}/package.json`);
    if (!mainManifest.ok) {
      throw new Error(
        `Could not fetch ${framework} template: GitHub tag ${tagName} and main branch are unavailable. ` +
          `Run from the shellui monorepo (local templates) or check your network.`,
      );
    }
    const result = await fetchTemplateFiles(mainBaseUrl, targetDir, framework, { fetchImpl });
    if (!result.ok) {
      throw new Error(
        `Failed to fetch ${framework} template files from main (no files downloaded)`,
      );
    }
    return { source: 'github-main', ref: 'main' };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Could not fetch')) {
      throw err;
    }
    if (err instanceof Error && err.message.startsWith('Failed to fetch')) {
      throw err;
    }
    throw new Error(
      `Could not fetch ${framework} template: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
