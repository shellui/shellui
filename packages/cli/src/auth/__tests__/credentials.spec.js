import { test, describe, beforeEach, afterEach, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  clearCredentials,
  getCredentialsDir,
  getCredentialsPath,
  getCredentialStorageInfo,
  isCredentialsShape,
  readCredentials,
  resetCredentialKeychainForTests,
  setCredentialKeychainForTests,
  writeCredentials,
} from '../credentials.js';

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
    /** @type {string | null} */
    let saved = null;
    setCredentialKeychainForTests({
      getPassword: () => saved,
      setPassword: (password) => {
        saved = password;
      },
      deletePassword: () => {
        const had = saved != null;
        saved = null;
        return had;
      },
    });
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
    setCredentialKeychainForTests({
      getPassword: () => null,
      setPassword: () => {
        throw new Error('secret service unavailable');
      },
      deletePassword: () => false,
    });
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
});
