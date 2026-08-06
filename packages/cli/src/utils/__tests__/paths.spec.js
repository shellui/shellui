import { test, describe, expect } from 'vitest';
import path from 'path';
import {
  DIST_DIR,
  WEB_DIST_DIR,
  DESKTOP_APP_DIR,
  getProjectRoot,
  getWebDistDir,
  getDesktopAppDir,
  DESKTOP_HOOK_CWD,
  DESKTOP_WEB_DIST,
} from '../paths.js';

const testCwd = '/tmp/my-project';

describe('paths', () => {
  test('web and desktop outputs live under dist/', () => {
    expect(WEB_DIST_DIR).toBe(path.join(DIST_DIR, 'web'));
    expect(DESKTOP_APP_DIR).toBe(path.join(DIST_DIR, 'app'));
  });

  test('getWebDistDir resolves dist/web under project root', () => {
    expect(getWebDistDir('.', testCwd)).toBe(path.join(testCwd, 'dist', 'web'));
  });

  test('getDesktopAppDir resolves dist/app under project root', () => {
    expect(getDesktopAppDir('.', testCwd)).toBe(path.join(testCwd, 'dist', 'app'));
  });

  test('getProjectRoot resolves relative root', () => {
    expect(getProjectRoot('./app', testCwd)).toBe(path.join(testCwd, 'app'));
  });

  test('desktop tauri hook paths are relative to dist/app/src-tauri', () => {
    expect(DESKTOP_HOOK_CWD).toBe('../../..');
    expect(DESKTOP_WEB_DIST).toBe('../../web');
  });
});
