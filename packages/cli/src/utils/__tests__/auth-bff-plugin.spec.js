import { afterEach, describe, expect, test } from 'vitest';
import {
  buildRefreshCookie,
  devBffCookieSecure,
  resolveBffUpstreamUrl,
} from '../auth-bff-plugin.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../');

const envSnapshot = {
  NODE_ENV: process.env.NODE_ENV,
  SHELLUI_BFF_SECURE_COOKIE: process.env.SHELLUI_BFF_SECURE_COOKIE,
  SHELLUI_BFF_BACKEND_URL: process.env.SHELLUI_BFF_BACKEND_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('dev BFF cookie', () => {
  test('omits Secure on http, even when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SHELLUI_BFF_SECURE_COOKIE;
    expect(devBffCookieSecure({ headers: {}, socket: {} })).toBe(false);
    expect(buildRefreshCookie('shellui_refresh', 'abc', { secure: false })).not.toContain('Secure');
  });

  test('sets Secure for https or when the flag is on', () => {
    delete process.env.SHELLUI_BFF_SECURE_COOKIE;
    expect(devBffCookieSecure({ headers: { 'x-forwarded-proto': 'https' }, socket: {} })).toBe(
      true,
    );
    expect(devBffCookieSecure({ headers: { 'x-forwarded-proto': 'http' }, socket: {} })).toBe(
      false,
    );
    process.env.SHELLUI_BFF_SECURE_COOKIE = '1';
    expect(devBffCookieSecure({ headers: {}, socket: {} })).toBe(true);
    expect(buildRefreshCookie('shellui_refresh', 'abc', { secure: true })).toContain('Secure');
    process.env.SHELLUI_BFF_SECURE_COOKIE = '0';
    expect(
      devBffCookieSecure({
        headers: { 'x-forwarded-proto': 'https' },
        socket: { encrypted: true },
      }),
    ).toBe(false);
  });
});

describe('resolveBffUpstreamUrl', () => {
  test('uses backend.url unless the dev container override is set', () => {
    delete process.env.SHELLUI_BFF_BACKEND_URL;
    expect(resolveBffUpstreamUrl('http://localhost:8001/')).toBe('http://localhost:8001');
    process.env.SHELLUI_BFF_BACKEND_URL = 'http://identity:8000/';
    expect(resolveBffUpstreamUrl('http://localhost:8001')).toBe('http://identity:8000');
  });
});

describe('dev stack BFF config', () => {
  test('enables bff auth and points container refresh at identity', () => {
    const security = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'dev/config/shellui.security.config.json'), 'utf8'),
    );
    expect(security.security.bffAuth.enabled).toBe(true);
    const compose = fs.readFileSync(path.join(repoRoot, 'dev/docker-compose.yml'), 'utf8');
    expect(compose).toContain('SHELLUI_BFF_BACKEND_URL: http://identity:8000');
    const entry = fs.readFileSync(
      path.join(repoRoot, 'dev/container/shell-dev-entrypoint.sh'),
      'utf8',
    );
    expect(entry).toContain('packages/cli/bin/shellui.js start');
  });
});
