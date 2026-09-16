import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_BACKEND_URL,
  peekBackendFromConfig,
  resolveAuthTarget,
  validateAuthTarget,
} from '../resolve-target.js';
import { buildAuthorizeUrl, fetchOAuthProviders } from '../login-flow.js';
import { MAIN_CONFIG_FILE, findProjectConfigDir } from '../../utils/config-paths.js';

describe('resolveAuthTarget', () => {
  /** @type {string} */
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-auth-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('errors when no config is found before .git', () => {
    fs.mkdirSync(path.join(tmpRoot, '.git'));
    const nested = path.join(tmpRoot, 'apps', 'web');
    fs.mkdirSync(nested, { recursive: true });

    const target = resolveAuthTarget({ root: nested });
    expect(target.configDir).toBeNull();
    expect(target.backendUrl).toBe(DEFAULT_BACKEND_URL);
    expect(validateAuthTarget(target)).toMatch(/No shellui\.config\.json/);
  });

  test('resolves backend url and companyId without loginUrl', () => {
    fs.writeFileSync(
      path.join(tmpRoot, MAIN_CONFIG_FILE),
      JSON.stringify({
        port: 4000,
        backend: {
          type: 'shellui',
          url: 'http://localhost:8000',
          companyId: 9,
          adminUrl: 'https://admin.example.com',
        },
      }),
    );
    const { backend: peeked } = peekBackendFromConfig(tmpRoot);
    expect(peeked?.companyId).toBe(9);
    const target = resolveAuthTarget({ root: tmpRoot });
    expect(target).toMatchObject({
      backendUrl: 'http://localhost:8000',
      companyId: '9',
    });
    expect(target).not.toHaveProperty('loginOrigin');
    expect(validateAuthTarget(target)).toBeNull();
  });

  test('finds config by walking up to .git', () => {
    fs.writeFileSync(
      path.join(tmpRoot, MAIN_CONFIG_FILE),
      JSON.stringify({
        backend: {
          type: 'shellui',
          url: 'https://id.example.com',
          companyId: 42,
        },
      }),
    );
    const nested = path.join(tmpRoot, 'packages', 'app');
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, '.git'));

    expect(findProjectConfigDir(nested)).toBe(path.resolve(tmpRoot));
    const target = resolveAuthTarget({ root: nested });
    expect(target).toMatchObject({
      backendUrl: 'https://id.example.com',
      companyId: '42',
    });
    expect(validateAuthTarget(target)).toBeNull();
  });

  test('rejects non-shellui backend type', () => {
    const err = validateAuthTarget({
      backendUrl: 'https://id.shellui.com',
      companyId: '1',
      backendType: 'supabase',
      configDir: '/tmp/project',
    });
    expect(err).toMatch(/shellui/);
  });
});

describe('buildAuthorizeUrl', () => {
  test('points at identity authorize with redirect_to', () => {
    const url = buildAuthorizeUrl({
      backendUrl: 'http://localhost:8000/',
      companyId: '3',
      provider: 'github',
      redirectTo: 'http://127.0.0.1:9999/callback',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://localhost:8000/api/v1/authorize');
    expect(parsed.searchParams.get('provider')).toBe('github');
    expect(parsed.searchParams.get('company_id')).toBe('3');
    expect(parsed.searchParams.get('redirect_to')).toBe('http://127.0.0.1:9999/callback');
  });

  test('omits provider when not specified so identity shows method picker', () => {
    const url = buildAuthorizeUrl({
      backendUrl: 'http://localhost:8000',
      companyId: '3',
      redirectTo: 'http://127.0.0.1:9999/callback',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('provider')).toBe(false);
    expect(parsed.searchParams.get('company_id')).toBe('3');
  });
});

describe('fetchOAuthProviders', () => {
  test('reads oauthProviders from settings payload', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      /** @type {Response} */ ({
        ok: true,
        json: async () => ({
          oauthProviders: ['github', 'google'],
          external: { github: true, google: true },
        }),
      });
    try {
      const providers = await fetchOAuthProviders('http://localhost:8000', '1');
      expect(providers).toEqual(['github', 'google']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
