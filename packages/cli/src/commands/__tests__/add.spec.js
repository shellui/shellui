import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addAppCommand,
  isOfficialAppUrl,
  marketplaceAppEndpoint,
  navigationItemFromCatalog,
  RESERVED_NAV_SEGMENTS,
} from '../add.js';
import { RESERVED_PATH_SEGMENTS } from '../../../../sdk/src/marketplace/overlayContract.ts';
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

  test('trusts the app URL against the code allowlist, not the catalog flag', () => {
    const official = navigationItemFromCatalog(
      catalog({
        url: 'https://notes.shellui.com/',
        official: false,
        safeForAuthToken: true,
        icon: 'https://cdn.example/icon.png',
      }),
    );
    expect(official.ok).toBe(true);
    if (!official.ok) return;
    expect(official.item.safeForAuthToken).toBe(true);
    expect(official.summary.official).toBe(true);
    expect(official.item.icon).toBe('https://cdn.example/icon.png');

    const poisoned = navigationItemFromCatalog(
      catalog({
        url: 'https://evil.example/',
        official: true,
        firstParty: true,
        safeForAuthToken: true,
      }),
    );
    expect(poisoned.ok).toBe(false);
    const plain = navigationItemFromCatalog(
      catalog({ url: 'https://evil.example/', official: true }),
    );
    expect(plain.ok).toBe(true);
    if (plain.ok) {
      expect(plain.summary.official).toBe(false);
      expect(plain.item.safeForAuthToken).toBeUndefined();
    }
    expect(navigationItemFromCatalog(catalog({ url: 'http://notes.example/' })).ok).toBe(false);
    const inline = navigationItemFromCatalog(catalog({ icon: '<svg></svg>' }));
    expect(inline.ok).toBe(true);
    if (inline.ok) expect(inline.item.icon).toBeUndefined();
  });

  test('matches official hosts exactly', () => {
    expect(isOfficialAppUrl('https://shellui.com/')).toBe(true);
    expect(isOfficialAppUrl('https://files.shellui.com/app')).toBe(true);
    for (const url of [
      'https://shellui.com.evil.example/',
      'https://notshellui.com/',
      'http://files.shellui.com/',
      'https://user:pw@files.shellui.com/',
      'not a url',
    ]) {
      expect(isOfficialAppUrl(url)).toBe(false);
    }
  });

  test('refuses a core shell path', () => {
    for (const path of ['admin', 'files', 'Settings/profile', '__settings', 'legal']) {
      expect(navigationItemFromCatalog(catalog({ path })).ok).toBe(false);
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

describe('shared reserved paths', () => {
  test('the CLI refuses the same first segments as the shell and identity', () => {
    // The CLI keeps its own short copy so it needs no SDK at run time. This guards drift.
    expect([...RESERVED_NAV_SEGMENTS].sort()).toEqual([...RESERVED_PATH_SEGMENTS].sort());
  });
});
