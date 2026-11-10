const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const {DEFAULT_TITLE, INDEX_DOC, TEMPLATE_COPY, readSiteDescription} = require('../og/copy');
const {assignGeneratedImage} = require('../og/front-matter');
const {imagePathForPermalink, permalinkForFile} = require('../og/permalink');
const {eyebrowFor, indexSidebars} = require('../og/section');
const {wrapText} = require('../og/wrap');
const sidebars = require('../sidebars');

const repoRoot = path.resolve(__dirname, '../../..');
const docsDir = path.join(repoRoot, 'docs');
const mainRoot = [{dir: docsDir, routeBasePath: '/'}];

const measure = (line) => line.length * 10;

test('template copy has no dashes', () => {
  for (const line of TEMPLATE_COPY) {
    assert.equal(line.includes('—') || line.includes('–'), false, line);
    assert.equal(/\s-\s/.test(line), false, line);
    assert.equal(line.includes('...'), false, line);
  }
  assert.equal(TEMPLATE_COPY[0], DEFAULT_TITLE);
});

test('default card description is the docs home description', () => {
  const description = readSiteDescription();
  assert.equal(
    description,
    'Developer map for Shellui, a microfrontend shell with shared navigation, authentication, administration, and storage.',
  );
  assert.match(fs.readFileSync(INDEX_DOC, 'utf8'), /Developer map for Shellui, a microfrontend shell/);
  assert.equal(/\s-\s/.test(description), false);
});

test('permalinks follow the docs routes', () => {
  const cases = [
    ['index.md', {}, '/'],
    ['installation.md', {}, '/installation'],
    ['features/navigation.md', {}, '/features/navigation'],
    ['sdk.md', {}, '/sdk'],
    ['adr/0001-ai-skill.md', {slug: '/adr/ai-skill'}, '/adr/ai-skill'],
    ['plans/open-source-or-cloud.md', {}, '/plans/open-source-or-cloud'],
  ];
  for (const [rel, frontMatter, permalink] of cases) {
    assert.equal(
      permalinkForFile(
        {docsDir, routeBasePath: '/', filePath: path.join(docsDir, rel)},
        frontMatter,
      ),
      permalink,
    );
    const slug = permalink === '/' ? 'index' : permalink.replace(/^\//, '');
    assert.equal(imagePathForPermalink(permalink), `img/og/${slug}.png`);
  }
});

test('service index and nested docs get prefixed slugs', () => {
  const identity = {docsDir: '/tmp/identity/docs', routeBasePath: 'identity'};
  assert.equal(
    permalinkForFile({...identity, filePath: '/tmp/identity/docs/index.md'}, {}),
    '/identity',
  );
  assert.equal(
    permalinkForFile({...identity, filePath: '/tmp/identity/docs/scim.md'}, {}),
    '/identity/scim',
  );
  assert.equal(imagePathForPermalink('/identity/scim'), 'img/og/identity/scim.png');
});

test('front matter image overrides the generated card', () => {
  const filePath = path.join(docsDir, 'sdk.md');
  const custom = {image: 'img/custom-card.png', title: 'Call the iframe SDK'};
  assert.equal(assignGeneratedImage(custom, filePath, mainRoot), false);
  assert.equal(custom.image, 'img/custom-card.png');

  const absolute = {image: 'https://example.com/card.png'};
  assert.equal(assignGeneratedImage(absolute, filePath, mainRoot), false);
  assert.equal(absolute.image, 'https://example.com/card.png');

  const generated = {title: 'Call the iframe SDK'};
  assert.equal(assignGeneratedImage(generated, filePath, mainRoot), true);
  assert.equal(generated.image, 'img/og/sdk.png');
});

test('mdx partials are not given a generated card', () => {
  const frontMatter = {};
  const filePath = path.join(docsDir, '_partial.mdx');
  assert.equal(assignGeneratedImage(frontMatter, filePath, mainRoot), false);
  assert.equal('image' in frontMatter, false);
});

test('files outside the docs roots are left alone', () => {
  const frontMatter = {};
  assert.equal(
    assignGeneratedImage(frontMatter, path.join(repoRoot, 'README.md'), mainRoot),
    false,
  );
  assert.equal('image' in frontMatter, false);
});

test('section labels come from the sidebar, folder, or service', () => {
  const placements = indexSidebars(sidebars);
  assert.equal(
    eyebrowFor({docId: 'features/navigation', placement: placements.get('features/navigation')}),
    'Features',
  );
  assert.equal(
    eyebrowFor({
      docId: 'features/authentication',
      placement: placements.get('features/authentication'),
    }),
    'Getting Started',
  );
  assert.equal(eyebrowFor({docId: 'sdk', placement: placements.get('sdk')}), 'SDK');
  assert.equal(eyebrowFor({docId: 'cli', placement: placements.get('cli')}), 'CLI');
  assert.equal(eyebrowFor({docId: 'core', placement: placements.get('core')}), 'Core');
  assert.equal(eyebrowFor({docId: 'tauri', placement: placements.get('tauri')}), 'Desktop App');
  assert.equal(
    eyebrowFor({docId: 'adr/ai-skill', placement: placements.get('adr/ai-skill')}),
    'ADR',
  );
  assert.equal(eyebrowFor({docId: 'installation', placement: placements.get('installation')}), 'Getting Started');
  assert.equal(eyebrowFor({docId: 'index', placement: placements.get('index')}), null);
  assert.equal(eyebrowFor({docId: 'plans/open-source-or-cloud', placement: null}), 'Plans');
  assert.equal(eyebrowFor({docId: 'features/ai', placement: null}), 'Features');
  assert.equal(
    eyebrowFor({
      docId: 'scim',
      placement: {categories: ['Companies and users'], label: 'SCIM provisioning'},
      serviceLabel: 'Identity',
    }),
    'Companies and users',
  );
  assert.equal(eyebrowFor({docId: 'index', placement: null, serviceLabel: 'Identity'}), 'Identity');
});

test('titles wrap to two lines and then truncate', () => {
  assert.deepEqual(wrapText('Show a toast', measure, 200, 2), ['Show a toast']);
  assert.deepEqual(wrapText('aa bb cc dd', measure, 50, 2), ['aa bb', 'cc dd']);

  const wrapped = wrapText('aa bb cc dd ee', measure, 50, 2);
  assert.equal(wrapped.length, 2);
  assert.equal(wrapped[0], 'aa bb');
  assert.equal(wrapped[1].endsWith('…'), true);
  assert.equal(wrapped[1].includes('...'), false);
  for (const line of wrapped) {
    assert.ok(measure(line) <= 50, line);
  }

  const longWord = wrapText('abcdefghij', measure, 50, 2);
  assert.equal(longWord.length, 1);
  assert.equal(longWord[0].endsWith('…'), true);
  assert.ok(measure(longWord[0]) <= 50);

  assert.deepEqual(wrapText('  spaced   out  ', measure, 200, 2), ['spaced out']);
  assert.deepEqual(wrapText('', measure, 50, 2), []);
});
