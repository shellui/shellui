// @ts-check
const fs = require('fs');
const path = require('path');
const {MANIFEST_PATH, REPO_ROOT} = require('../services');
const {imagePathForPermalink, permalinkForFile} = require('./permalink');

/**
 * @typedef {{dir: string, routeBasePath: string}} DocRoot
 */

/**
 * Docs roots that are part of this site: the main `docs/` tree plus each
 * fetched service. Missing service manifest means main docs only.
 * @returns {DocRoot[]}
 */
function docRoots() {
  /** @type {DocRoot[]} */
  const roots = [{dir: path.join(REPO_ROOT, 'docs'), routeBasePath: '/'}];
  if (!fs.existsSync(MANIFEST_PATH)) {
    return roots;
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  for (const service of manifest.services || []) {
    if (typeof service.docsPath === 'string' && typeof service.routeBasePath === 'string') {
      roots.push({dir: path.resolve(service.docsPath), routeBasePath: service.routeBasePath});
    }
  }
  return roots;
}

/**
 * @param {string} filePath
 * @param {DocRoot[]} roots
 * @returns {DocRoot | null}
 */
function locateDoc(filePath, roots) {
  const resolved = path.resolve(filePath);
  let best = null;
  let bestLength = -1;
  for (const root of roots) {
    const dir = path.resolve(root.dir);
    const rel = path.relative(dir, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      continue;
    }
    if (dir.length > bestLength) {
      best = {dir, routeBasePath: root.routeBasePath};
      bestLength = dir.length;
    }
  }
  return best;
}

/**
 * @param {Record<string, unknown>} frontMatter
 * @returns {string}
 */
function imageFromFrontMatter(frontMatter) {
  const image = frontMatter && frontMatter.image;
  return typeof image === 'string' && image.trim() ? image.trim() : '';
}

/**
 * Set `image` to the generated card unless the page already names one.
 * @param {Record<string, unknown>} frontMatter
 * @param {string} filePath
 * @param {DocRoot[]} [roots]
 * @returns {boolean} True when this call assigned a generated path.
 */
function assignGeneratedImage(frontMatter, filePath, roots = docRoots()) {
  if (imageFromFrontMatter(frontMatter)) {
    return false;
  }
  const located = locateDoc(filePath, roots);
  if (!located || !/\.mdx?$/.test(filePath) || path.basename(filePath).startsWith('_')) {
    return false;
  }
  const permalink = permalinkForFile(
    {docsDir: located.dir, routeBasePath: located.routeBasePath, filePath},
    frontMatter,
  );
  frontMatter.image = imagePathForPermalink(permalink);
  return true;
}

module.exports = {
  assignGeneratedImage,
  docRoots,
  imageFromFrontMatter,
  locateDoc,
};
