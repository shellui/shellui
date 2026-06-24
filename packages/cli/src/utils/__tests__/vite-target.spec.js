import { test, describe, expect, afterEach } from 'vitest';
import { resolveShelluiTarget, getShelluiTargetDefine } from '../vite.js';

describe('resolveShelluiTarget', () => {
  const originalTarget = process.env.SHELLUI_TARGET;

  afterEach(() => {
    if (originalTarget === undefined) {
      delete process.env.SHELLUI_TARGET;
    } else {
      process.env.SHELLUI_TARGET = originalTarget;
    }
  });

  test('defaults to web', () => {
    delete process.env.SHELLUI_TARGET;
    expect(resolveShelluiTarget({})).toBe('web');
  });

  test('reads SHELLUI_TARGET env', () => {
    process.env.SHELLUI_TARGET = 'tauri';
    expect(resolveShelluiTarget({})).toBe('tauri');
  });

  test('supports legacy config.runtime for backward compatibility', () => {
    delete process.env.SHELLUI_TARGET;
    expect(resolveShelluiTarget({ runtime: 'tauri' })).toBe('tauri');
  });

  test('env takes precedence over legacy config.runtime', () => {
    process.env.SHELLUI_TARGET = 'web';
    expect(resolveShelluiTarget({ runtime: 'tauri' })).toBe('web');
  });

  test('getShelluiTargetDefine serializes target', () => {
    process.env.SHELLUI_TARGET = 'tauri';
    expect(getShelluiTargetDefine({})).toEqual({ __SHELLUI_TARGET__: '"tauri"' });
  });
});
