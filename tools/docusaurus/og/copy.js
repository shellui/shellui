// @ts-check
const fs = require('fs');
const path = require('path');

/** Site-wide social card heading. Matches the docs home title. */
const DEFAULT_TITLE = 'Shellui docs';

/** Fallback social card. Committed. Per-page cards are build output. */
const DEFAULT_IMAGE = 'img/og/default.png';

/**
 * Strings this template authors. The site description is read from the docs
 * home page so the card stays on the existing line.
 * No em dashes, en dashes, or hyphen-as-dash in these strings.
 */
const TEMPLATE_COPY = ['Shellui docs', 'shellui.com', 'docs.shellui.com', 'MIT licensed'];

const INDEX_DOC = path.resolve(__dirname, '../../../docs/index.md');

/**
 * Description line already published on the docs home page.
 * @returns {string}
 */
function readSiteDescription() {
  const text = fs.readFileSync(INDEX_DOC, 'utf8');
  const frontMatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontMatter) {
    throw new Error(`Missing front matter in ${INDEX_DOC}`);
  }
  const line = frontMatter[1].split(/\r?\n/).find((entry) => entry.startsWith('description:'));
  const match = line && line.match(/^description:\s+(['"])(.*)\1\s*$/);
  if (!match) {
    throw new Error(`Missing description in ${INDEX_DOC}`);
  }
  return match[2];
}

module.exports = {
  DEFAULT_IMAGE,
  DEFAULT_TITLE,
  INDEX_DOC,
  TEMPLATE_COPY,
  readSiteDescription,
};
