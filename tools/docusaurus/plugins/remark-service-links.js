// @ts-check
/**
 * Remark plugin applied to every service docs instance.
 *
 * Service docs were written for their own Docusaurus site at the root of the
 * service repository. Inside the main site two kinds of links break:
 *
 * 1. Relative links that leave `docs/`, such as `[PUBLISH.md](../PUBLISH.md)`.
 *    Only `docs/` is fetched, so these become links to the file on GitHub.
 * 2. Absolute links to the old service docs hosts, such as
 *    `https://identity.docs.shellui.com/scim`. These become internal links,
 *    for example `/identity/scim`, so they stay on docs.shellui.com and are
 *    checked by `onBrokenLinks`.
 *
 * The plugin has no dependencies so it works with any remark version that
 * Docusaurus ships.
 */

const path = require('path');

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * @typedef {object} Options
 * @property {string} docsPath Absolute path of the service docs folder.
 * @property {string} repo GitHub `owner/name`.
 * @property {string} ref Branch, tag or commit used for GitHub links.
 * @property {Record<string, string>} hostRoutes Old host to route base, for example
 *   `{'identity.docs.shellui.com': '/identity'}`.
 */

/**
 * @param {any} node
 * @param {(node: any) => void} visit
 */
function walk(node, visit) {
  visit(node);
  if (node && Array.isArray(node.children)) {
    for (const child of node.children) {
      walk(child, visit);
    }
  }
}

/**
 * @param {string} url
 * @returns {{pathname: string, suffix: string}}
 */
function splitSuffix(url) {
  const index = url.search(/[?#]/);
  if (index === -1) {
    return {pathname: url, suffix: ''};
  }
  return {pathname: url.slice(0, index), suffix: url.slice(index)};
}

/**
 * @param {string} url
 * @param {Options} options
 * @returns {string | null}
 */
function rewriteLegacyHost(url, options) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  const route = options.hostRoutes[parsed.host];
  if (!route) {
    return null;
  }
  const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
  return `${route}${pathname}${parsed.search}${parsed.hash}` || '/';
}

/**
 * @param {string} url
 * @param {string} filePath
 * @param {Options} options
 * @param {'blob' | 'raw'} kind
 * @returns {string | null}
 */
function rewriteOutsideDocs(url, filePath, options, kind) {
  if (!url || url.startsWith('#') || url.startsWith('/') || SCHEME.test(url)) {
    return null;
  }
  const {pathname, suffix} = splitSuffix(url);
  if (!pathname) {
    return null;
  }
  let decoded = pathname;
  try {
    decoded = decodeURI(pathname);
  } catch {
    // Keep the raw value.
  }
  const target = path.resolve(path.dirname(filePath), decoded);
  const fromDocs = path.relative(options.docsPath, target);
  if (!fromDocs.startsWith('..') && !path.isAbsolute(fromDocs)) {
    return null;
  }
  const repoRoot = path.dirname(options.docsPath);
  const fromRepo = path.relative(repoRoot, target);
  if (fromRepo.startsWith('..') || path.isAbsolute(fromRepo)) {
    return null;
  }
  const repoPath = fromRepo.split(path.sep).map(encodeURIComponent).join('/');
  if (kind === 'raw') {
    return `https://raw.githubusercontent.com/${options.repo}/${options.ref}/${repoPath}${suffix}`;
  }
  return `https://github.com/${options.repo}/blob/${options.ref}/${repoPath}${suffix}`;
}

/** @param {Options} options */
function remarkServiceLinks(options) {
  return (/** @type {any} */ tree, /** @type {any} */ file) => {
    const filePath = file && (file.path || (file.history && file.history[0]));
    walk(tree, (node) => {
      if (!node || typeof node.url !== 'string') {
        return;
      }
      if (node.type !== 'link' && node.type !== 'definition' && node.type !== 'image') {
        return;
      }
      const legacy = node.type === 'image' ? null : rewriteLegacyHost(node.url, options);
      if (legacy) {
        // A bare URL shown as link text would still print the old host.
        const onlyChild = node.children && node.children.length === 1 ? node.children[0] : null;
        if (onlyChild && onlyChild.type === 'text' && onlyChild.value === node.url) {
          onlyChild.value = `https://docs.shellui.com${legacy}`;
        }
        node.url = legacy;
        return;
      }
      if (filePath) {
        const outside = rewriteOutsideDocs(
          node.url,
          filePath,
          options,
          node.type === 'image' ? 'raw' : 'blob',
        );
        if (outside) {
          node.url = outside;
        }
      }
    });
  };
}

module.exports = remarkServiceLinks;
