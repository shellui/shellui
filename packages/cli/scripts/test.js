#!/usr/bin/env node

import { spawn } from 'child_process';

// Filter out --if-present flag that pnpm passes
const args = process.argv.slice(2).filter(arg => arg !== '--if-present');

const proc = spawn('npx', ['vitest', 'run', ...args], {
  stdio: 'inherit'
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});
