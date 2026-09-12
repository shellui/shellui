import { describe, test, expect } from 'vitest';
import {
  parseInitArgs,
  applyInitDefaults,
  validateInitOptions,
  normalizeCompanyId,
  buildBaseConfig,
  applyBackendConfig,
  buildInitConfig,
} from '../build-config.js';
import { DEFAULT_SHELLUI_BACKEND_URL } from '../registry.js';

describe('parseInitArgs', () => {
  test('treats react/vue/angular/empty as framework shortcuts', () => {
    expect(parseInitArgs('react')).toEqual({ root: '.', frameworkShortcut: 'react' });
    expect(parseInitArgs('vue')).toEqual({ root: '.', frameworkShortcut: 'vue' });
    expect(parseInitArgs('angular')).toEqual({ root: '.', frameworkShortcut: 'angular' });
    expect(parseInitArgs('empty')).toEqual({ root: '.', frameworkShortcut: 'empty' });
  });

  test('treats other strings as root directories', () => {
    expect(parseInitArgs('./my-app')).toEqual({ root: './my-app', frameworkShortcut: null });
    expect(parseInitArgs(undefined)).toEqual({ root: '.', frameworkShortcut: null });
  });
});

describe('applyInitDefaults', () => {
  test('defaults to empty + none when flags omitted', () => {
    expect(applyInitDefaults({ framework: null, backend: null })).toEqual({
      framework: 'empty',
      backend: 'none',
    });
  });

  test('preserves provided framework/backend', () => {
    expect(applyInitDefaults({ framework: 'react', backend: 'shellui' })).toEqual({
      framework: 'react',
      backend: 'shellui',
    });
  });
});

describe('validateInitOptions', () => {
  test('rejects unknown framework/backend', () => {
    expect(() => validateInitOptions({ framework: 'svelte', backend: 'none' })).toThrow(
      /Unknown framework/,
    );
    expect(() => validateInitOptions({ framework: 'empty', backend: 'firebase' })).toThrow(
      /Unknown backend/,
    );
  });

  test('requires --company-id for shellui backend', () => {
    expect(() => validateInitOptions({ framework: 'empty', backend: 'shellui' })).toThrow(
      /--company-id is required/,
    );
    expect(() =>
      validateInitOptions({ framework: 'empty', backend: 'shellui', companyId: '' }),
    ).toThrow(/--company-id is required/);
  });

  test('requires --supabase-url for supabase backend', () => {
    expect(() => validateInitOptions({ framework: 'empty', backend: 'supabase' })).toThrow(
      /--supabase-url is required/,
    );
  });

  test('accepts valid shellui and supabase options', () => {
    expect(() =>
      validateInitOptions({ framework: 'empty', backend: 'shellui', companyId: '42' }),
    ).not.toThrow();
    expect(() =>
      validateInitOptions({
        framework: 'empty',
        backend: 'supabase',
        supabaseUrl: 'https://abc.supabase.co',
      }),
    ).not.toThrow();
  });
});

describe('normalizeCompanyId', () => {
  test('coerces numeric strings to numbers', () => {
    expect(normalizeCompanyId('123')).toBe(123);
    expect(normalizeCompanyId(99)).toBe(99);
  });

  test('keeps non-numeric ids as strings', () => {
    expect(normalizeCompanyId('acme-corp')).toBe('acme-corp');
  });
});

describe('buildInitConfig / backend wiring', () => {
  test('empty + none omits backend key', () => {
    const config = buildInitConfig({ backend: 'none' });
    expect(config.backend).toBeUndefined();
    expect(config.port).toBe(4000);
    expect(config.title).toBe('My App');
    expect(config.$schema).toBeTruthy();
    expect(config.navigation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Home', path: '', url: '/' }),
        expect.objectContaining({ path: 'settings', openIn: 'modal' }),
      ]),
    );
  });

  test('shellui backend writes BackendConfig shape with companyId + login', () => {
    const config = buildInitConfig({ backend: 'shellui', companyId: '42' });
    expect(config.backend).toEqual({
      type: 'shellui',
      url: DEFAULT_SHELLUI_BACKEND_URL,
      companyId: 42,
      login: { methods: ['password', 'oauth'] },
    });
  });

  test('supabase backend writes type + url only', () => {
    const config = buildInitConfig({
      backend: 'supabase',
      supabaseUrl: 'https://xyz.supabase.co',
    });
    expect(config.backend).toEqual({
      type: 'supabase',
      url: 'https://xyz.supabase.co',
    });
  });

  test('applyBackendConfig does not mutate the base object for none', () => {
    const base = buildBaseConfig();
    const next = applyBackendConfig(base, { backend: 'none' });
    expect(next.backend).toBeUndefined();
    expect(base.backend).toBeUndefined();
  });
});

describe('buildInitConfig / companion wiring', () => {
  test('empty omits dev and keeps Home at shell root', () => {
    const config = buildInitConfig({ framework: 'empty', backend: 'none' });
    expect(config.dev).toBeUndefined();
    expect(config.port).toBe(4000);
    expect(config.navigation.find((n) => n.path === '' || n.path === '/').url).toBe('/');
  });

  test('other omits companion like empty', () => {
    const config = buildInitConfig({ framework: 'other', backend: 'none' });
    expect(config.dev).toBeUndefined();
    expect(config.navigation.find((n) => n.path === '' || n.path === '/').url).toBe('/');
  });

  test.each([
    ['react', 'http://localhost:5173'],
    ['vue', 'http://localhost:5173'],
    ['angular', 'http://localhost:4200'],
  ])('%s wires dev.run/url/name and Home to companion origin', (framework, companionUrl) => {
    const config = buildInitConfig({ framework, backend: 'none' });
    expect(config.port).toBe(4000);
    expect(config.dev).toEqual({
      run: 'npm run dev',
      url: companionUrl,
      name: framework,
    });
    expect(config.navigation.find((n) => n.path === '' || n.path === '/').url).toBe(
      `${companionUrl}/`,
    );
    expect(config.navigation.find((n) => n.path === 'settings').url).toBe('/__settings');

    const shellPort = new URL(`http://localhost:${config.port}`).port;
    const companionPort = new URL(companionUrl).port;
    expect(companionPort).not.toBe(shellPort);
  });

  test('dev.run uses detected package manager when provided', () => {
    const config = buildInitConfig({
      framework: 'react',
      backend: 'none',
      packageManager: 'pnpm',
    });
    expect(config.dev.run).toBe('pnpm run dev');
    expect(config.navigation.find((n) => n.path === '').path).toBe('');
  });
});
