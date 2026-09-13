import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

describe('@shellui/cli package files list', () => {
  test('publishes tauri templates but not heavy framework starters', () => {
    expect(pkg.files).toContain('templates/tauri');
    expect(pkg.files).not.toContain('templates');
    expect(pkg.files).not.toContain('templates/react');
    expect(pkg.files).not.toContain('templates/vue');
    expect(pkg.files).not.toContain('templates/angular');
  });

  test('still ships bin and src', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['bin', 'src', 'package.json']));
  });
});
