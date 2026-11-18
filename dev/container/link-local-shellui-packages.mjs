#!/usr/bin/env node
/**
 * Dev stack only: point @shellui/* in node_modules at the bind-mounted monorepo.
 * Does not modify package.json or lockfiles (node_modules live in a Compose volume).
 */
import fs from 'node:fs';
import path from 'node:path';

const [appDirArg, shelluiRootArg] = process.argv.slice(2);

if (!appDirArg || !shelluiRootArg) {
  console.error('Usage: link-local-shellui-packages.mjs <appDir> <shelluiRoot>');
  process.exit(1);
}

const appDir = path.resolve(appDirArg);
const shelluiRoot = path.resolve(shelluiRootArg);
const packagesDir = path.join(shelluiRoot, 'packages');

if (!fs.existsSync(packagesDir)) {
  process.exit(0);
}

/** @type {Record<string, string>} */
const packageNameToDir = {};
for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgJsonPath = path.join(packagesDir, entry.name, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (typeof pkg.name === 'string' && pkg.name.startsWith('@shellui/')) {
      packageNameToDir[pkg.name] = path.join(packagesDir, entry.name);
    }
  } catch {
    // skip invalid package.json
  }
}

const pkgPath = path.join(appDir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  process.exit(0);
}

/** @type {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} */
const appPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const declared = {
  ...appPkg.dependencies,
  ...appPkg.devDependencies,
};

const scopeDir = path.join(appDir, 'node_modules', '@shellui');
fs.mkdirSync(scopeDir, { recursive: true });

for (const name of Object.keys(declared)) {
  if (!name.startsWith('@shellui/')) continue;
  const localDir = packageNameToDir[name];
  if (!localDir || !fs.existsSync(localDir)) continue;

  const linkPath = path.join(scopeDir, name.slice('@shellui/'.length));
  if (fs.existsSync(linkPath)) {
    fs.rmSync(linkPath, { recursive: true, force: true });
  }
  fs.symlinkSync(localDir, linkPath, 'dir');
  process.stdout.write(`linked ${name} -> ${localDir}\n`);
}
