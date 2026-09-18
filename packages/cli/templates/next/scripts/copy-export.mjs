import fs from 'node:fs';
import path from 'node:path';

const src = path.join(process.cwd(), 'out');
const dest = path.join(process.cwd(), 'dist/web/app');

if (!fs.existsSync(src)) {
  console.error('Next export output not found at out/. Run next build first.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied Next export to ${dest}`);
