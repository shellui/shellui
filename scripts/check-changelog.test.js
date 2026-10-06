const test = require('node:test');
const assert = require('node:assert/strict');
const { checkChangelog, isValidVersion } = require('./check-changelog');

const template = `# Change log

<!---
## [Unreleased] - yyyy-mm-dd

### ✨ Feature - for new features
-->
`;

const changelog = (...headings) =>
  `${template}\n${headings.join('\n\n### 🐛 Bug Fixes\n\n- Fix.\n\n')}\n`;

test('accepts stable, alpha, and beta versions', () => {
  for (const version of ['0.6.0', '0.6.0-alpha.1', '0.6.0-beta.1', '10.20.30-beta.12']) {
    assert.equal(isValidVersion(version), true, version);
  }
});

test('rejects other version shapes', () => {
  for (const version of [
    '0.6',
    '0.6.0-rc.1',
    '0.6.0-beta',
    '0.6.0-beta.x',
    'v0.6.0',
    '0.6.0-beta.1.2',
  ]) {
    assert.equal(isValidVersion(version), false, version);
  }
});

test('passes when the top release matches a beta version', () => {
  const md = changelog('## [0.6.0-beta.1] - 2026-10-06', '## [0.5.3] - 2026-09-20');
  assert.deepEqual(checkChangelog(md, '0.6.0-beta.1'), []);
});

test('ignores the Unreleased heading inside the template comment', () => {
  const md = changelog('## [0.6.0] - 2026-10-06');
  assert.deepEqual(checkChangelog(md, '0.6.0'), []);
});

test('fails on an active Unreleased section', () => {
  const md = changelog('## [Unreleased]', '## [0.5.3] - 2026-09-20');
  const errors = checkChangelog(md, '0.5.3');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Unreleased/);
});

test('fails when the top release does not match package.json', () => {
  const md = changelog('## [0.6.0] - 2026-10-06');
  const errors = checkChangelog(md, '0.6.0-beta.1');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /expected "0.6.0-beta.1"/);
});

test('fails on undated or malformed release headings', () => {
  const md = changelog(
    '## [0.6.0-beta.1] - 2026-10-06',
    '## [0.5.4] - Unreleased',
    '## [0.5.3-rc.1] - 2026-09-20',
  );
  const errors = checkChangelog(md, '0.6.0-beta.1');
  assert.equal(errors.length, 2);
  assert.match(errors[0], /0\.5\.4/);
  assert.match(errors[1], /0\.5\.3-rc\.1/);
});
