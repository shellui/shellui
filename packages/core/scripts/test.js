#!/usr/bin/env node

import { spawn } from 'child_process';

// Filter out --if-present flag that pnpm passes in recursive runs.
const args = process.argv.slice(2).filter((arg) => arg !== '--if-present');

const proc = spawn('npx', ['vitest', 'run', '--config', 'vitest.config.ts', ...args], {
  stdio: 'inherit',
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});
