import { test, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { build } from 'vite';
import { SHELLUI_TSCONFIG_PATH } from '../vite.js';

async function transformedWith(tsconfig) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-tsconfig-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { jsx: 'react', jsxFactory: 'h' } }),
    );
    fs.writeFileSync(path.join(dir, 'entry.tsx'), 'export const A = () => <div />;\n');
    const result = await build({
      configFile: false,
      root: dir,
      logLevel: 'silent',
      tsconfig,
      build: {
        write: false,
        minify: false,
        lib: { entry: path.join(dir, 'entry.tsx'), formats: ['es'] },
        rolldownOptions: { external: [/^react/] },
      },
    });
    return (Array.isArray(result) ? result[0] : result).output[0].code;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('control: a consumer tsconfig changes JSX output when no tsconfig is pinned', async () => {
  expect(await transformedWith(undefined)).toMatch(/\bh\(/);
});

test('shell tsconfig ignores the consumer tsconfig', async () => {
  const code = await transformedWith(SHELLUI_TSCONFIG_PATH);
  expect(code).toMatch(/react\/jsx(-dev)?-runtime/);
  expect(code).not.toMatch(/\bh\(/);
});
