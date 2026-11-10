// @ts-check
const {SERVICES} = require('../services');
const {DEFAULT_IMAGE} = require('./copy');
const {imagePathForPermalink} = require('./permalink');
const {eyebrowFor, indexSidebars} = require('./section');
const {imageFromFrontMatter} = require('./front-matter');

const DOCS_PLUGIN = 'docusaurus-plugin-content-docs';

const SERVICE_LABELS = Object.fromEntries(SERVICES.map((service) => [service.id, service.label]));

/**
 * @param {string} text
 * @returns {string}
 */
function plainText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {Record<string, any>} allContent
 * @returns {{
 *   id: string,
 *   permalink: string,
 *   title: string,
 *   description: string,
 *   eyebrow: string | null,
 *   imagePath: string,
 * }[]}
 */
function collectCards(allContent) {
  const instances = allContent && allContent[DOCS_PLUGIN];
  if (!instances || typeof instances !== 'object') {
    throw new Error('Docs plugin content is missing. Social cards cannot be generated.');
  }

  /** @type {ReturnType<typeof collectCards>} */
  const cards = [];

  for (const [pluginId, content] of Object.entries(instances)) {
    const serviceLabel = SERVICE_LABELS[pluginId] || null;
    const versions = content && Array.isArray(content.loadedVersions) ? content.loadedVersions : [];
    for (const version of versions) {
      const placements = indexSidebars(version.sidebars);
      for (const doc of version.docs || []) {
        if (!doc || doc.draft || typeof doc.permalink !== 'string') {
          continue;
        }
        const expected = imagePathForPermalink(doc.permalink);
        const specified = imageFromFrontMatter(doc.frontMatter || {});
        if (expected === DEFAULT_IMAGE) {
          throw new Error(
            `Doc ${doc.permalink} would overwrite ${DEFAULT_IMAGE}. Rename that page or set image: in front matter.`,
          );
        }
        if (specified && specified !== expected) {
          if (specified.startsWith('img/og/') && specified !== DEFAULT_IMAGE) {
            throw new Error(
              `OG image path for ${doc.id} (${doc.permalink}) is ${specified}, expected ${expected}.`,
            );
          }
          continue;
        }
        if (!specified) {
          throw new Error(
            `Doc ${doc.id} (${doc.permalink}) has no social image. Expected ${expected}.`,
          );
        }
        cards.push({
          id: doc.id,
          permalink: doc.permalink,
          title: plainText(doc.title || doc.id),
          description: plainText(doc.description || ''),
          eyebrow: eyebrowFor({
            docId: doc.id,
            placement: placements.get(doc.id) || null,
            serviceLabel,
          }),
          imagePath: expected,
        });
      }
    }
  }

  return cards;
}

module.exports = {
  DOCS_PLUGIN,
  collectCards,
};
