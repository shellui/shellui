#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const path = require('path');
const {renderDefaultCard} = require('../og/card');

async function main() {
  const png = await renderDefaultCard();
  const dest = path.join(__dirname, '../static/img/og/default.png');
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, png);
  process.stdout.write(`wrote ${dest}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
});
