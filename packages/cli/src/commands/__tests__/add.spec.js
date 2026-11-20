import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { addAppCommand, marketplaceAppEndpoint, navigationItemFromCatalog } from '../add.js';
import { MAIN_CONFIG_FILE } from '../../utils/config-paths.js';

const testRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-fixtures-add');
const originalCwd = process.cwd();
const originalLog = console.log;
const originalError = console.error;

function catalog(overrides = {}) {
  return {
    name: 'Notes',
    url: 'https://notes.example/app/',
    path: 'notes',
    official: false,
    ...overrides,
  };
}

describe('navigationItemFromCatalog', () => {
  test('builds an item and refuses auth on a non-official app', () => {
    const ok = navigationItemFromCatalog(catalog());
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.item).toEqual({
      label: 'Notes',
      path: 'notes',
      url: 'https://notes.example/app/',
    });
    expect(ok.item.safeForAuthToken).toBeUndefined();

    const refused = navigationItemFromCatalog(catalog({ safeForAuthToken: true }));
    expect(refused.ok).toBe(false);

    const allowed = navigationItemFromCatalog(catalog({ safeForAuthToken: true }), {
      allowAuth: true,
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.item.safeForAuthToken).toBe(true);
  });

  test('allows safeForAuthToken on an official catalog app and rejects http', () => {
    const official = navigationItemFromCatalog(
      catalog({ official: true, safeForAuthToken: true, icon: 'https://cdn.example/icon.png' }),
    );
    expect(official.ok).toBe(true);
    if (!official.ok) return;
    expect(official.item.safeForAuthToken).toBe(true);
    expect(official.item.icon).toBe('https://cdn.example/icon.png');

    expect(navigationItemFromCatalog(catalog({ url: 'http://notes.example/' })).ok).toBe(false);
    expect(navigationItemFromCatalog(catalog({ icon: '<svg></svg>' })).ok).toBe(true);
    if (navigationItemFromCatalog(catalog({ icon: '<svg></svg>' })).ok) {
      const item = navigationItemFromCatalog(catalog({ icon: '<svg></svg>' }));
      if (item.ok) expect(item.item.icon).toBeUndefined();
    }
  });

  test('uses the marketplace apps path', () => {
    expect(marketplaceAppEndpoint(undefined, 'notes')).toBe(
      'https://api.marketplace.shellui.com/api/apps/notes',
    );
    expect(marketplaceAppEndpoint('https://example.test/api/apps/', 'my app')).toBe(
      'https://example.test/api/apps/my%20app',
    );
  });
});

describe('addAppCommand', () => {
  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(testRoot);
    process.chdir(testRoot);
    console.log = vi.fn();
    console.error = vi.fn();
    process.exitCode = 0;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = 0;
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  test('writes the navigation item from a mocked catalog response', async () => {
    fs.writeFileSync(
      MAIN_CONFIG_FILE,
      JSON.stringify({ title: 'Shell', navigation: [{ label: 'Home', path: 'home', url: '/' }] }),
    );
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => catalog(),
    }));

    await addAppCommand('notes', { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.marketplace.shellui.com/api/apps/notes',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    const config = JSON.parse(fs.readFileSync(MAIN_CONFIG_FILE, 'utf8'));
    expect(config.navigation.map((item) => item.path)).toEqual(['home', 'notes']);
    expect(config.navigation[1].safeForAuthToken).toBeUndefined();
    expect(process.exitCode).toBe(0);
    expect(console.log).toHaveBeenCalled();
  });

  test('honors --api-url and refuses a duplicate path', async () => {
    fs.writeFileSync(
      MAIN_CONFIG_FILE,
      JSON.stringify({
        navigation: [{ label: 'Notes', path: 'notes', url: 'https://notes.example/' }],
      }),
    );
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => catalog(),
    }));

    await addAppCommand('notes', { apiUrl: 'https://catalog.example', fetchImpl });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://catalog.example/api/apps/notes');
    expect(process.exitCode).toBe(1);
    const config = JSON.parse(fs.readFileSync(MAIN_CONFIG_FILE, 'utf8'));
    expect(config.navigation).toHaveLength(1);
  });

  test('stops when a non-official app requests the auth token', async () => {
    fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify({ navigation: [] }));
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => catalog({ safeForAuthToken: true }),
    }));

    await addAppCommand('notes', { fetchImpl });

    expect(process.exitCode).toBe(1);
    const config = JSON.parse(fs.readFileSync(MAIN_CONFIG_FILE, 'utf8'));
    expect(config.navigation).toEqual([]);
  });
});
