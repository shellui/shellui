// @ts-check
const path = require('path');

// Mirrors @docusaurus/plugin-content-docs slug + number-prefix rules so the
// image path set while front matter is parsed matches the built permalink.

const ignoredPrefixPattern = /^\d+[-_.]\d+/;
const numberPrefixPattern = /^(?<numberPrefix>\d+)\s*[-_.]+\s*(?<suffix>[^-_.\s].*)$/;

/**
 * @param {string} filename
 * @returns {string}
 */
function stripNumberPrefix(filename) {
  if (ignoredPrefixPattern.test(filename)) {
    return filename;
  }
  const match = numberPrefixPattern.exec(filename);
  return match && match.groups && match.groups.suffix ? match.groups.suffix : filename;
}

/**
 * @param {string} value
 * @returns {string}
 */
function stripPathNumberPrefixes(value) {
  return value
    .split('/')
    .map((segment) => stripNumberPrefix(segment))
    .join('/');
}

/**
 * @param {string} to
 * @param {string} from
 * @returns {string}
 */
function resolvePathname(to, from) {
  if (to.startsWith('/')) {
    return to;
  }
  const base = from.endsWith('/') ? from : from.replace(/\/[^/]*$/, '/');
  return new URL(to, `https://docs.shellui.com${base}`).pathname;
}

/**
 * @param {{
 *   baseID: string,
 *   frontMatterSlug?: string,
 *   source: string,
 *   sourceDirName: string,
 *   parsePrefixes?: boolean,
 * }} input
 * @returns {string}
 */
function getSlug({baseID, frontMatterSlug, source, sourceDirName, parsePrefixes = true}) {
  if (frontMatterSlug && frontMatterSlug.startsWith('/')) {
    return frontMatterSlug;
  }
  const dirStripped = parsePrefixes ? stripPathNumberPrefixes(sourceDirName) : sourceDirName;
  const dirNameSlug = sourceDirName === '.' ? '/' : `/${dirStripped}/`;
  const fileName = path.posix.parse(source).name;
  const parentDir = sourceDirName.split('/').reverse()[0];
  const indexNames = ['index', 'readme', parentDir && parentDir.toLowerCase()].filter(Boolean);
  if (!frontMatterSlug && indexNames.includes(fileName.toLowerCase())) {
    return dirNameSlug;
  }
  return resolvePathname(frontMatterSlug || baseID, dirNameSlug);
}

/**
 * @param {string} routeBasePath
 * @param {string} slug
 * @returns {string}
 */
function joinPermalink(routeBasePath, slug) {
  const base =
    !routeBasePath || routeBasePath === '/'
      ? '/'
      : `/${routeBasePath.replace(/^\/+|\/+$/g, '')}`;
  if (!slug || slug === '/') {
    return base === '/' ? '/' : base.replace(/\/$/, '');
  }
  return `${base.replace(/\/$/, '')}/${slug.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
}

/**
 * @param {string} permalink
 * @returns {string} Site path such as `img/og/features/navigation.png`.
 */
function imagePathForPermalink(permalink) {
  const slug = String(permalink)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
  return `img/og/${slug || 'index'}.png`;
}

/**
 * @param {{docsDir: string, routeBasePath: string, filePath: string}} located
 * @param {Record<string, unknown>} frontMatter
 * @returns {string}
 */
function permalinkForFile(located, frontMatter) {
  const rel = path.relative(located.docsDir, located.filePath).split(path.sep).join('/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`${located.filePath} is outside ${located.docsDir}`);
  }
  const sourceDirName = path.posix.dirname(rel);
  const filename = path.posix.parse(rel).name;
  const parsePrefixes = frontMatter.parse_number_prefixes !== false;
  const explicitId = frontMatter.id;
  const baseID =
    typeof explicitId === 'string' && explicitId
      ? explicitId
      : parsePrefixes
        ? stripNumberPrefix(filename)
        : filename;
  const slugValue = frontMatter.slug;
  const slug = getSlug({
    baseID,
    frontMatterSlug: typeof slugValue === 'string' ? slugValue : undefined,
    source: rel,
    sourceDirName,
    parsePrefixes,
  });
  return joinPermalink(located.routeBasePath, slug);
}

module.exports = {
  getSlug,
  imagePathForPermalink,
  joinPermalink,
  permalinkForFile,
  stripNumberPrefix,
};
