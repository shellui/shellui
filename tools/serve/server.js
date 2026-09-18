#!/usr/bin/env node
/**
 * Monorepo wrapper — delegates to the CLI serve-dist script.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(__dirname, '../../packages/cli/scripts/serve-dist.mjs');
const port = process.argv[2];

const child = spawn(process.execPath, port ? [script, port] : [script], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '../..'),
});

child.on('exit', (code) => process.exit(code ?? 0));
