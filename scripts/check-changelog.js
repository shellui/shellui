#!/usr/bin/env node
/**
 * Validates CHANGELOG.md against the root package.json version before a release:
 * - The root version is `x.y.z`, `x.y.z-alpha.N`, or `x.y.z-beta.N`
 * - Every release heading (outside the template comment) reads `## [<version>] - YYYY-MM-DD`
 * - The topmost release is the root version
 * - No active `## [Unreleased]` section is left
 *
 * Run from repo root: node scripts/check-changelog.js
 * Or: pnpm run changelog:check
 */

const fs = require('fs');
const path = require('path');

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-(?:alpha|beta)\.\d+)?$/;
const RELEASE_HEADING_PATTERN = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/;

function isValidVersion(version) {
  return VERSION_PATTERN.test(version);
}

/** `## ` headings outside HTML comments, so the template block at the top is ignored. */
function readReleaseHeadings(markdown) {
  const headings = [];
  let inComment = false;
  markdown.split('\n').forEach((raw, index) => {
    const line = raw.trimEnd();
    if (line.includes('<!--')) inComment = true;
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      return;
    }
    if (line.startsWith('## ')) headings.push({ line, lineNumber: index + 1 });
  });
  return headings;
}

function checkChangelog(markdown, version) {
  const errors = [];

  if (!isValidVersion(version)) {
    errors.push(`package.json version "${version}" must be x.y.z, x.y.z-alpha.N, or x.y.z-beta.N`);
  }

  const headings = readReleaseHeadings(markdown);
  const releases = [];
  for (const { line, lineNumber } of headings) {
    if (/^## \[Unreleased\]/.test(line)) {
      errors.push(
        `line ${lineNumber}: active "## [Unreleased]" section; move its notes into the release`,
      );
      continue;
    }
    const match = line.match(RELEASE_HEADING_PATTERN);
    if (!match || !isValidVersion(match[1])) {
      errors.push(
        `line ${lineNumber}: "${line}" must read "## [x.y.z] - YYYY-MM-DD" (x.y.z may end in -alpha.N or -beta.N)`,
      );
      continue;
    }
    releases.push({ version: match[1], lineNumber });
  }

  if (releases.length === 0) {
    errors.push('no release headings found');
  } else if (releases[0].version !== version) {
    errors.push(
      `top release is "${releases[0].version}" (line ${releases[0].lineNumber}), expected "${version}" from package.json`,
    );
  }

  return errors;
}

module.exports = { checkChangelog, isValidVersion };

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..');
  const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const markdown = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
  const errors = checkChangelog(markdown, version);

  if (errors.length > 0) {
    console.error(`CHANGELOG.md is not ready for ${version}:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`CHANGELOG.md is ready for ${version}.`);
}
