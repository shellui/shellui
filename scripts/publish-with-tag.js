#!/usr/bin/env node
/**
 * Syncs the root version to all packages, builds, then publishes SDK, Core,
 * and CLI in order. The npm dist-tag is chosen from the root package.json version:
 * - version contains "alpha" → --tag alpha
 * - version contains "beta"  → --tag beta
 * - otherwise                → --tag latest
 *
 * Run from repo root: node scripts/publish-with-tag.js
 * Or: pnpm run publish
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const rootPkgPath = path.join(repoRoot, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const version = rootPkg.version;

if (!version) {
  console.error('Root package.json has no version field.');
  process.exit(1);
}

function tagFromVersion(v) {
  if (v.includes('alpha')) return 'alpha';
  if (v.includes('beta')) return 'beta';
  return 'latest';
}

const tag = tagFromVersion(version);

// Sync root version to all packages so we never publish out of sync
console.log('Syncing version across packages...');
const syncResult = spawnSync('node', [path.join(__dirname, 'sync-package-versions.js')], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (syncResult.status !== 0) {
  process.exit(syncResult.status);
}

// Build so we publish built artifacts
console.log('\nBuilding all packages...');
const buildResult = spawnSync('pnpm', ['run', 'build:all'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});
if (buildResult.status !== 0) {
  process.exit(buildResult.status);
}

console.log(`\nVersion: ${version} → publishing with --tag ${tag}\n`);

const filters = ['@shellui/sdk', '@shellui/core', '@shellui/cli'];

for (const filter of filters) {
  const args = ['--filter', filter, 'publish', '--no-git-checks', '--tag', tag];
  console.log(`pnpm --filter ${filter} publish --no-git-checks --tag ${tag}`);
  const result = spawnSync('pnpm', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

console.log(`\nPublished all packages with tag "${tag}".`);
