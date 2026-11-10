// @ts-check
const fs = require('fs');
const path = require('path');
const {DEFAULT_IMAGE} = require('./copy');
const {collectCards} = require('./collect');

/**
 * Build-time social cards. Front matter points each doc at `img/og/<slug>.png`
 * before the page renders. This hook writes the PNGs into the build output
 * after static files are copied. `static/img/og/default.png` is the only card
 * that is committed. The build directory is gitignored.
 * @returns {import('@docusaurus/types').Plugin}
 */
function ogImagesPlugin() {
  /** @type {ReturnType<typeof collectCards>} */
  let cards = [];

  return {
    name: 'shellui-og-images',
    async allContentLoaded({allContent}) {
      cards = collectCards(allContent);
    },
    async postBuild({outDir}) {
      const {renderDefaultCard, renderOgCard} = require('./card');
      const jobs = cards.map((card) => ({
        imagePath: card.imagePath,
        render: () =>
          renderOgCard({
            eyebrow: card.eyebrow,
            title: card.title,
            description: card.description,
            brand: 'Shellui docs',
          }),
      }));
      jobs.push({
        imagePath: DEFAULT_IMAGE,
        render: () => renderDefaultCard(),
      });

      for (const job of jobs) {
        const png = await job.render();
        const dest = path.join(outDir, job.imagePath);
        fs.mkdirSync(path.dirname(dest), {recursive: true});
        fs.writeFileSync(dest, png);
      }

      const pageCount = cards.length;
      const longest = cards.reduce((best, card) =>
        card.title.length > best.title.length ? card : best,
      );
      process.stdout.write(`[og] wrote ${pageCount} page cards and ${DEFAULT_IMAGE}\n`);
      process.stdout.write(`[og] longest title: ${longest.title} -> ${longest.imagePath}\n`);
    },
  };
}

module.exports = ogImagesPlugin;
