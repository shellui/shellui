import fs from 'node:fs';
import path from 'node:path';

const browserDir = path.join(process.cwd(), 'dist/web/app/browser');
const dest = path.join(process.cwd(), 'dist/web/app');

if (!fs.existsSync(browserDir)) {
  console.error('Angular browser output not found. Run ng build first.');
  process.exit(1);
}

for (const entry of fs.readdirSync(browserDir)) {
  const srcPath = path.join(browserDir, entry);
  const destPath = path.join(dest, entry);
  fs.rmSync(destPath, { recursive: true, force: true });
  fs.cpSync(srcPath, destPath, { recursive: true });
}

fs.rmSync(browserDir, { recursive: true, force: true });
console.log(`Flattened Angular browser build into ${dest}`);
