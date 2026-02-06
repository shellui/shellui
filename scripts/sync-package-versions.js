#!/usr/bin/env node
/**
 * Syncs the version field from the root package.json to all package.json
 * files under packages/. Run from repo root: node scripts/sync-package-versions.js
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const rootPkgPath = path.join(repoRoot, 'package.json');
const packagesDir = path.join(repoRoot, 'packages');

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const version = rootPkg.version;

if (!version) {
  console.error('Root package.json has no version field.');
  process.exit(1);
}

const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
let updated = 0;

for (const entry of entries) {
  if (!entry.isDirectory()) continue;

  const pkgPath = path.join(packagesDir, entry.name, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.version === version) continue;

  const oldVersion = pkg.version;
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`${entry.name}: ${oldVersion} → ${version}`);
  updated++;
}

if (updated === 0) {
  console.log('All packages already at root version:', version);
} else {
  console.log('Updated', updated, 'package(s) to version', version);
}
