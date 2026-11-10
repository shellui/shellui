import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loginCommand } from '../login.js';
import { readCredentials, resetCredentialKeychainForTests } from '../../auth/credentials.js';
import { MAIN_CONFIG_FILE } from '../../utils/config-paths.js';

const USER_CODE = 'WXYZ-1234';
const COMPLETE = `https://id.example/oauth/cli/device?user_code=${USER_CODE}`;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('loginCommand', () => {
  /** @type {string} */
  let tmpRoot;
  /** @type {string | undefined} */
  let prevXdg;
  /** @type {number | undefined} */
  let prevExit;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-login-'));
    prevXdg = process.env.XDG_CONFIG_HOME;
    prevExit = process.exitCode;
    process.env.XDG_CONFIG_HOME = path.join(tmpRoot, 'xdg');
    process.exitCode = 0;
    fs.writeFileSync(
      path.join(tmpRoot, MAIN_CONFIG_FILE),
      JSON.stringify({
        backend: {
          type: 'shellui',
          url: 'https://id.example/',
          companyId: 9,
        },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetCredentialKeychainForTests();
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    process.exitCode = prevExit;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('stores the device-login session and skips the browser with --no-browser', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/oauth/cli/device/code')) {
        return jsonResponse({
          device_code: 'device-secret-value',
          user_code: USER_CODE,
          verification_uri: 'https://id.example/oauth/cli/device',
          verification_uri_complete: COMPLETE,
          expires_in: 600,
          interval: 1,
        });
      }
      return jsonResponse({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_in: 120,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await loginCommand(tmpRoot, { noBrowser: true });

    expect(process.exitCode).toBe(0);
    const saved = readCredentials({ backendUrl: 'https://id.example', companyId: '9' });
    expect(saved).toMatchObject({
      backendUrl: 'https://id.example',
      companyId: '9',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    });
    expect(saved?.expiresAt).toEqual(expect.any(Number));
    const printed = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(printed).toContain(USER_CODE);
    expect(printed).toContain(COMPLETE);
    expect(printed).toContain('Logged in successfully.');
    expect(printed).not.toContain('device-secret-value');
    const deviceBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(deviceBody).toEqual({ client_id: 'shellui-cli', company_id: '9' });
    log.mockRestore();
  });

  test('Ctrl+C cancels before credentials are stored', async () => {
    const fetchMock = vi.fn((url, init) => {
      if (!String(url).endsWith('/oauth/cli/device/code')) {
        return Promise.reject(new Error(`unexpected ${url}`));
      }
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
        process.emit('SIGINT');
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const listenersBefore = process.listenerCount('SIGINT');

    await loginCommand(tmpRoot, { noBrowser: true });

    expect(process.exitCode).toBe(130);
    expect(process.listenerCount('SIGINT')).toBe(listenersBefore);
    expect(readCredentials({ backendUrl: 'https://id.example', companyId: '9' })).toBeNull();
    const errors = error.mock.calls.map((call) => String(call[0])).join('\n');
    expect(errors).toContain('Login cancelled.');
    expect(log.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain(
      'Logged in successfully.',
    );
    error.mockRestore();
    log.mockRestore();
  });
});
