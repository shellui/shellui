#!/usr/bin/env node
// @ts-check
/**
 * Fail the docs build when a page's social image is missing or not a built PNG.
 * Pages with no generated card must point at img/og/default.png.
 */

const fs = require('fs');
const path = require('path');

const SITE = 'https://docs.shellui.com';
const BUILD_DIR = path.join(__dirname, '..', 'build');
const DEFAULT_PATH = '/img/og/default.png';

/**
 * @param {string} dir
 * @returns {string[]}
 */
function htmlFiles(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...htmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      found.push(full);
    }
  }
  return found;
}

/**
 * @param {string} html
 * @param {string} attr
 * @param {string} key
 * @returns {string[]}
 */
function metaValues(html, attr, key) {
  /** @type {string[]} */
  const values = [];
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    /** @type {Record<string, string>} */
    const attrs = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
      attrs[match[1].toLowerCase()] = match[2];
    }
    if (attrs[attr] === key && attrs.content) {
      values.push(attrs.content);
    }
  }
  return values;
}

function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    throw new Error(`Docs build directory is missing: ${BUILD_DIR}`);
  }
  const files = htmlFiles(BUILD_DIR);
  if (files.length === 0) {
    throw new Error(`No HTML files in ${BUILD_DIR}`);
  }

  /** @type {string[]} */
  const failures = [];
  /** @type {Set<string>} */
  const pageImages = new Set();
  let defaultPages = 0;

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const og = metaValues(html, 'property', 'og:image');
    const twitter = metaValues(html, 'name', 'twitter:image');
    const rel = path.relative(BUILD_DIR, file);
    if (og.length !== 1) {
      failures.push(`${rel}: expected one og:image, found ${og.length}`);
    }
    if (twitter.length !== 1) {
      failures.push(`${rel}: expected one twitter:image, found ${twitter.length}`);
    }
    const ogUrl = og[0];
    const twitterUrl = twitter[0];
    if (!ogUrl || !twitterUrl) {
      continue;
    }
    if (ogUrl !== twitterUrl) {
      failures.push(`${rel}: og:image and twitter:image differ`);
    }
    if (!ogUrl.startsWith(`${SITE}/`)) {
      failures.push(`${rel}: image is not an absolute ${SITE} URL (${ogUrl})`);
      continue;
    }
    let pathname = '';
    try {
      pathname = decodeURIComponent(new URL(ogUrl).pathname);
    } catch (error) {
      failures.push(`${rel}: bad image URL ${ogUrl}`);
      continue;
    }
    if (!pathname.startsWith('/img/og/') || !pathname.endsWith('.png')) {
      failures.push(`${rel}: image is not an /img/og PNG (${pathname})`);
      continue;
    }
    const disk = path.join(BUILD_DIR, pathname);
    if (!fs.existsSync(disk)) {
      failures.push(`${rel}: missing file for ${pathname}`);
    }
    if (pathname === DEFAULT_PATH) {
      defaultPages += 1;
    } else {
      pageImages.add(pathname);
    }
  }

  const notFound = path.join(BUILD_DIR, '404.html');
  if (fs.existsSync(notFound)) {
    const og = metaValues(fs.readFileSync(notFound, 'utf8'), 'property', 'og:image');
    if (og[0] !== `${SITE}${DEFAULT_PATH}`) {
      failures.push(`404.html should fall back to ${DEFAULT_PATH}, got ${og[0] || 'nothing'}`);
    }
  } else {
    failures.push('404.html is missing');
  }

  const installation = path.join(BUILD_DIR, 'installation', 'index.html');
  if (fs.existsSync(installation)) {
    const og = metaValues(fs.readFileSync(installation, 'utf8'), 'property', 'og:image');
    const expected = `${SITE}/img/og/installation.png`;
    if (og[0] !== expected) {
      failures.push(`installation should use ${expected}, got ${og[0] || 'nothing'}`);
    }
  }

  if (defaultPages < 1) {
    failures.push('no page fell back to default.png');
  }
  if (pageImages.size < 1) {
    failures.push('no page got its own card');
  }

  if (failures.length > 0) {
    process.stderr.write(failures.map((line) => `[og] ${line}`).join('\n') + '\n');
    process.exit(1);
  }

  process.stdout.write(
    `[og] ${files.length} HTML pages, ${pageImages.size} page cards, ${defaultPages} using default.png\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
}
