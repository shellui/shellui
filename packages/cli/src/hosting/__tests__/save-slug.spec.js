import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { saveHostingSlug } from '../save-slug.js';

describe('saveHostingSlug', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-slug-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const file = () => path.join(dir, 'shellui.config.json');

  test('writes hosting.slug and keeps other keys, order and indent', () => {
    fs.writeFileSync(
      file(),
      '{\n    "title": "App",\n    "hosting": {\n        "url": "${HOSTING_URL}"\n    },\n    "version": "1.0.0"\n}\n',
    );
    const result = saveHostingSlug(dir, 'blue-fox');
    expect(result.saved).toBe(true);
    expect(fs.readFileSync(file(), 'utf8')).toBe(
      '{\n    "title": "App",\n    "hosting": {\n        "url": "${HOSTING_URL}",\n        "slug": "blue-fox"\n    },\n    "version": "1.0.0"\n}\n',
    );
  });

  test('does not overwrite an existing slug', () => {
    fs.writeFileSync(file(), JSON.stringify({ hosting: { url: 'x', slug: '${SLUG}' } }));
    expect(saveHostingSlug(dir, 'new').saved).toBe(false);
    expect(JSON.parse(fs.readFileSync(file(), 'utf8')).hosting.slug).toBe('${SLUG}');
  });

  test('skips split configs', () => {
    fs.writeFileSync(
      path.join(dir, 'shellui.hosting.config.json'),
      JSON.stringify({ hosting: { url: 'x' } }),
    );
    expect(saveHostingSlug(dir, 'new').saved).toBe(false);
  });
});
