import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  clearCredentials,
  getCredentialsDir,
  getCredentialsPath,
  isCredentialsShape,
  readCredentials,
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

  test('readCredentials returns null for corrupt file', () => {
    fs.mkdirSync(getCredentialsDir(), { recursive: true });
    fs.writeFileSync(getCredentialsPath(), '{not-json', 'utf8');
    expect(readCredentials()).toBeNull();
  });
});
