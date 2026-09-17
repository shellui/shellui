import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applyProductionBuildEnvDefaults,
  DEFAULT_PRODUCTION_APP_URL,
  loadProjectEnvFiles,
  prepareBuildEnvironment,
} from '../project-env.js';
import { substituteEnvInConfig } from '../config-env.js';

describe('applyProductionBuildEnvDefaults', () => {
  test('sets SHELLUI_APP_URL to /app when unset or empty', () => {
    const env = {};
    applyProductionBuildEnvDefaults(env);
    expect(env.SHELLUI_APP_URL).toBe(DEFAULT_PRODUCTION_APP_URL);

    const empty = { SHELLUI_APP_URL: '' };
    applyProductionBuildEnvDefaults(empty);
    expect(empty.SHELLUI_APP_URL).toBe(DEFAULT_PRODUCTION_APP_URL);
  });

  test('does not override an existing SHELLUI_APP_URL', () => {
    const env = { SHELLUI_APP_URL: 'https://cdn.example.com/app' };
    applyProductionBuildEnvDefaults(env);
    expect(env.SHELLUI_APP_URL).toBe('https://cdn.example.com/app');
  });
});

describe('loadProjectEnvFiles', () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-env-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.SHELLUI_APP_URL;
  });

  test('loads values from project .env', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      'SHELLUI_APP_URL=https://from-dotenv.example/app\n',
      'utf-8',
    );
    loadProjectEnvFiles(tmpDir);
    expect(process.env.SHELLUI_APP_URL).toBe('https://from-dotenv.example/app');
  });

  test('.env.local overrides .env', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SHELLUI_APP_URL=/from-env\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.env.local'), 'SHELLUI_APP_URL=/from-local\n', 'utf-8');
    loadProjectEnvFiles(tmpDir);
    expect(process.env.SHELLUI_APP_URL).toBe('/from-local');
  });
});

describe('prepareBuildEnvironment + config substitution', () => {
  /** @type {string} */
  let tmpDir;
  /** @type {string | undefined} */
  let prevAppUrl;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-build-env-'));
    prevAppUrl = process.env.SHELLUI_APP_URL;
    delete process.env.SHELLUI_APP_URL;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (prevAppUrl === undefined) delete process.env.SHELLUI_APP_URL;
    else process.env.SHELLUI_APP_URL = prevAppUrl;
  });

  test('defaults Home nav url to /app/ when no .env is present', () => {
    prepareBuildEnvironment(tmpDir);

    const { value } = substituteEnvInConfig({
      navigation: [{ label: 'Home', path: '', url: '${SHELLUI_APP_URL:-http://localhost:5173}/' }],
    });

    expect(value.navigation[0].url).toBe('/app/');
  });

  test('respects SHELLUI_APP_URL from project .env during build prep', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SHELLUI_APP_URL=/custom\n', 'utf-8');
    prepareBuildEnvironment(tmpDir);

    const { value } = substituteEnvInConfig({
      navigation: [{ label: 'Home', path: '', url: '${SHELLUI_APP_URL:-http://localhost:5173}/' }],
    });

    expect(value.navigation[0].url).toBe('/custom/');
  });
});
