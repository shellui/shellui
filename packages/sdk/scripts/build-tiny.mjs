import * as esbuild from 'esbuild';
import { writeFileSync } from 'node:fs';

const result = await esbuild.build({
  entryPoints: ['src/tiny.ts'],
  bundle: true,
  minify: true,
  target: 'es2018',
  format: 'iife',
  outfile: 'dist/shellui.tiny.js',
  write: false,
  legalComments: 'none',
});

writeFileSync('dist/shellui.tiny.js', result.outputFiles[0].contents);

const bytes = result.outputFiles[0].contents.byteLength;
console.log(`shellui.tiny.js  ${(bytes / 1024).toFixed(2)} KB`);
