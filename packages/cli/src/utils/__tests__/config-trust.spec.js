import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkConfigPathTrust } from '../config-trust.js';

describe('checkConfigPathTrust', () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-config-trust-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('warns when config dir is outside project root', () => {
    const projectRoot = path.join(tmpDir, 'project');
    const configDir = path.join(tmpDir, 'external-config');
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    const warnings = checkConfigPathTrust({ projectRoot, configDir });
    expect(warnings.some((w) => w.includes('outside project root'))).toBe(true);
  });

  test('rejects world-writable config files on Unix', () => {
    if (process.platform === 'win32') return;

    const projectRoot = path.join(tmpDir, 'project');
    const configDir = projectRoot;
    const configPath = path.join(configDir, 'shellui.config.json');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, '{}');
    fs.chmodSync(configPath, 0o666);

    expect(() =>
      checkConfigPathTrust({ projectRoot, configDir, configPath, isTypeScript: false }),
    ).toThrow(/world-writable/);
  });

  test('rejects symlink escape outside project root', () => {
    const projectRoot = path.join(tmpDir, 'project');
    const outside = path.join(tmpDir, 'outside');
    const linkPath = path.join(projectRoot, 'shellui.config.json');
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'shellui.config.json'), '{}');
    fs.symlinkSync(path.join(outside, 'shellui.config.json'), linkPath);

    expect(() =>
      checkConfigPathTrust({
        projectRoot,
        configDir: projectRoot,
        configPath: linkPath,
      }),
    ).toThrow(/outside project root/);
  });

  test('warns for TypeScript config execution', () => {
    const projectRoot = path.join(tmpDir, 'project');
    fs.mkdirSync(projectRoot, { recursive: true });
    const warnings = checkConfigPathTrust({
      projectRoot,
      configDir: projectRoot,
      configPath: path.join(projectRoot, 'shellui.config.ts'),
      isTypeScript: true,
    });
    expect(warnings.some((w) => w.includes('TypeScript config executes'))).toBe(true);
  });
});
