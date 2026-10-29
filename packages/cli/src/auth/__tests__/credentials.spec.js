import { test, describe, beforeEach, afterEach, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  accountKey,
  clearCredentials,
  listAccounts,
  setActiveAccount,
  getCredentialsDir,
  getCredentialsPath,
  getCredentialStorageInfo,
  isCredentialsShape,
  readCredentials,
  resetCredentialKeychainForTests,
  setCredentialKeychainForTests,
  writeCredentials,
} from '../credentials.js';

function memoryKeychain() {
  /** @type {Map<string, string>} */
  const store = new Map();
  return {
    store,
    factory: (/** @type {string} */ name) => ({
      getPassword: () => store.get(name) ?? null,
      setPassword: (/** @type {string} */ value) => {
        store.set(name, value);
      },
      deletePassword: () => store.delete(name),
    }),
  };
}

const A = { backendUrl: 'https://eu.id.example', companyId: '1' };
const B = { backendUrl: 'https://us.id.example', companyId: '2' };

describe('credentials', () => {
  /** @type {string} */
  let tmpHome;
  /** @type {string | undefined} */
  let prevXdg;
  /** @type {string | undefined} */
  let prevAppData;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-cred-'));
    prevXdg = process.env.XDG_CONFIG_HOME;
    prevAppData = process.env.APPDATA;
    process.env.XDG_CONFIG_HOME = path.join(tmpHome, 'xdg');
    delete process.env.APPDATA;
  });

  afterEach(() => {
    resetCredentialKeychainForTests();
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    if (prevAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = prevAppData;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('getCredentialsDir uses XDG_CONFIG_HOME when set', () => {
    expect(getCredentialsDir()).toBe(path.join(tmpHome, 'xdg', 'shellui'));
    expect(getCredentialsPath()).toBe(path.join(tmpHome, 'xdg', 'shellui', 'credentials.json'));
  });

  test('writeCredentials creates 0600 file and readCredentials round-trips', () => {
    writeCredentials({
      backendUrl: 'https://id.shellui.com/',
      companyId: 1,
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 1_700_000_000,
      tokenType: 'bearer',
    });
    const filePath = getCredentialsPath();
    expect(fs.existsSync(filePath)).toBe(true);
    if (process.platform !== 'win32') {
      const mode = fs.statSync(filePath).mode & 0o777;
      expect(mode).toBe(0o600);
      const dirMode = fs.statSync(getCredentialsDir()).mode & 0o777;
      expect(dirMode).toBe(0o700);
    }
    const session = readCredentials();
    expect(session).toMatchObject({
      backendUrl: 'https://id.shellui.com',
      companyId: '1',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 1_700_000_000,
      tokenType: 'bearer',
    });
  });

  test('clearCredentials removes the file', () => {
    writeCredentials({
      backendUrl: 'https://id.shellui.com',
      companyId: '1',
      accessToken: 'a',
      refreshToken: 'r',
    });
    expect(clearCredentials()).toBe(true);
    expect(readCredentials()).toBeNull();
    expect(clearCredentials()).toBe(false);
  });

  test('isCredentialsShape rejects incomplete payloads', () => {
    expect(isCredentialsShape(null)).toBe(false);
    expect(isCredentialsShape({ backendUrl: 'x' })).toBe(false);
    expect(
      isCredentialsShape({
        backendUrl: 'https://id.shellui.com',
        companyId: '1',
        accessToken: 'a',
        refreshToken: 'r',
      }),
    ).toBe(true);
  });

  test('getCredentialStorageInfo documents keychain with a 0600 file fallback', () => {
    const info = getCredentialStorageInfo();
    expect(info.format).toBe('os-keychain-with-0600-file-fallback');
    expect(info.unixPermissions.file).toBe('0600');
    expect(info.followUp).toMatch(/keychain/i);
  });

  test('stores credentials in the keychain and does not leave the token file', () => {
    setCredentialKeychainForTests(memoryKeychain().factory);
    writeCredentials({
      backendUrl: 'https://id.shellui.com',
      companyId: '1',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(fs.existsSync(getCredentialsPath())).toBe(false);
    expect(readCredentials()).toMatchObject({ accessToken: 'access', refreshToken: 'refresh' });
    expect(clearCredentials()).toBe(true);
    expect(readCredentials()).toBeNull();
    resetCredentialKeychainForTests();
  });

  test('falls back to the 0600 file and warns when the keychain write fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setCredentialKeychainForTests(() => ({
      getPassword: () => null,
      setPassword: () => {
        throw new Error('secret service unavailable');
      },
      deletePassword: () => false,
    }));
    writeCredentials({
      backendUrl: 'https://id.shellui.com',
      companyId: '1',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(fs.existsSync(getCredentialsPath())).toBe(true);
    expect(readCredentials()).toMatchObject({ refreshToken: 'refresh' });
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/0600/);
    warn.mockRestore();
    resetCredentialKeychainForTests();
  });

  test('readCredentials returns null for corrupt file', () => {
    fs.mkdirSync(getCredentialsDir(), { recursive: true });
    fs.writeFileSync(getCredentialsPath(), '{not-json', 'utf8');
    expect(readCredentials()).toBeNull();
  });
  test('keeps one keychain entry per account and switches with setActiveAccount', () => {
    const kc = memoryKeychain();
    setCredentialKeychainForTests(kc.factory);
    writeCredentials({ ...A, accessToken: 'a1', refreshToken: 'r1' });
    writeCredentials({ ...B, accessToken: 'a2', refreshToken: 'r2' });
    expect(kc.store.size).toBe(2);
    expect(listAccounts()).toEqual([accountKey(A), accountKey(B)]);
    expect(readCredentials()).toMatchObject({ accessToken: 'a2' });
    expect(readCredentials(A)).toMatchObject({ accessToken: 'a1' });
    setActiveAccount(A);
    expect(readCredentials()).toMatchObject({ accessToken: 'a1' });
    const index = fs.readFileSync(path.join(getCredentialsDir(), 'accounts.json'), 'utf8');
    expect(index).not.toMatch(/a1|r1|a2|r2/);
  });

  test('clearCredentials removes only the given account', () => {
    setCredentialKeychainForTests(memoryKeychain().factory);
    writeCredentials({ ...A, accessToken: 'a1', refreshToken: 'r1' });
    writeCredentials({ ...B, accessToken: 'a2', refreshToken: 'r2' });
    expect(clearCredentials(A)).toBe(true);
    expect(readCredentials(A)).toBeNull();
    expect(readCredentials(B)).toMatchObject({ accessToken: 'a2' });
    expect(listAccounts()).toEqual([accountKey(B)]);
  });

  test('file fallback stores accounts under the same keys', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setCredentialKeychainForTests(null);
    writeCredentials({ ...A, accessToken: 'a1', refreshToken: 'r1' });
    writeCredentials({ ...B, accessToken: 'a2', refreshToken: 'r2' });
    const file = JSON.parse(fs.readFileSync(getCredentialsPath(), 'utf8'));
    expect(Object.keys(file.accounts)).toEqual([accountKey(A), accountKey(B)]);
    expect(readCredentials(A)).toMatchObject({ refreshToken: 'r1' });
    vi.restoreAllMocks();
  });

  test('migrates the legacy single keychain entry without losing the login', () => {
    const kc = memoryKeychain();
    kc.store.set(
      'cli-credentials',
      JSON.stringify({ version: 1, ...A, accessToken: 'old', refreshToken: 'oldr' }),
    );
    setCredentialKeychainForTests(kc.factory);
    expect(readCredentials()).toMatchObject({ accessToken: 'old', refreshToken: 'oldr' });
    expect(kc.store.has('cli-credentials')).toBe(false);
    expect(kc.store.has(`cli-credentials:${accountKey(A)}`)).toBe(true);
  });

  test('migrates a legacy flat credentials file', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fs.mkdirSync(getCredentialsDir(), { recursive: true });
    fs.writeFileSync(
      getCredentialsPath(),
      JSON.stringify({ version: 1, ...A, accessToken: 'old', refreshToken: 'oldr' }),
    );
    setCredentialKeychainForTests(null);
    expect(readCredentials()).toMatchObject({ accessToken: 'old' });
    const file = JSON.parse(fs.readFileSync(getCredentialsPath(), 'utf8'));
    expect(file.accounts[accountKey(A)]).toBeTruthy();
    vi.restoreAllMocks();
  });
});
