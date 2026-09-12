import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  cliVersionToTag,
  buildTemplateBaseUrl,
  resolveLocalTemplatePath,
  fetchTemplateFiles,
  resolveFrameworkTemplate,
  getLocalTemplateCandidates,
} from '../templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = path.join(__dirname, 'test-fixtures-templates');
const repoRoot = path.resolve(__dirname, '../../../../..');
const cliPackageRoot = path.resolve(__dirname, '../../..');

describe('template helpers', () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('cliVersionToTag prefixes v when missing', () => {
    expect(cliVersionToTag('0.5.0-beta.2')).toBe('v0.5.0-beta.2');
    expect(cliVersionToTag('v1.2.3')).toBe('v1.2.3');
  });

  test('buildTemplateBaseUrl targets CLI version tag path', () => {
    expect(buildTemplateBaseUrl('react', 'v0.5.0-beta.2')).toBe(
      'https://raw.githubusercontent.com/shellui/shellui/v0.5.0-beta.2/packages/cli/templates/react',
    );
  });

  test('getLocalTemplateCandidates includes package-relative and monorepo paths', () => {
    expect(
      getLocalTemplateCandidates('react', {
        cwd: '/repo',
        cliPackageRoot: '/repo/packages/cli',
      }),
    ).toEqual([
      '/repo/packages/cli/templates/react',
      '/repo/packages/cli/templates/react',
      '/repo/templates/react',
    ]);
  });

  test('resolveLocalTemplatePath finds monorepo templates when present', () => {
    const local = resolveLocalTemplatePath('react', {
      cwd: repoRoot,
      cliPackageRoot,
    });
    expect(local).toBeTruthy();
    expect(fs.existsSync(path.join(local, 'package.json'))).toBe(true);
  });

  test('fetchTemplateFiles writes only successful responses', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('package.json')) {
        return {
          ok: true,
          text: async () => '{"name":"x"}',
          arrayBuffer: async () => new TextEncoder().encode('{"name":"x"}').buffer,
        };
      }
      return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
    });

    const result = await fetchTemplateFiles('https://example.test/react', testDir, 'react', {
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.fetched).toContain('package.json');
    expect(result.missing.length).toBeGreaterThan(0);
    expect(fs.readFileSync(path.join(testDir, 'package.json'), 'utf-8')).toBe('{"name":"x"}');
  });

  test('resolveFrameworkTemplate uses local path when available (no network)', async () => {
    const target = path.join(testDir, 'out');
    const info = [];
    const result = await resolveFrameworkTemplate('react', target, '0.5.0-beta.2', {
      cwd: repoRoot,
      cliPackageRoot,
      fetchImpl: vi.fn(async () => {
        throw new Error('network should not be called when local exists');
      }),
      onInfo: (m) => info.push(m),
    });

    expect(result.source).toBe('local');
    expect(fs.existsSync(path.join(target, 'package.json'))).toBe(true);
    expect(info.some((m) => /local template/i.test(m))).toBe(true);
  });

  test('resolveFrameworkTemplate errors clearly when tag and main are unavailable', async () => {
    const target = path.join(testDir, 'remote');
    const fetchImpl = vi.fn(async () => ({ ok: false, text: async () => '' }));

    await expect(
      resolveFrameworkTemplate('vue', target, '9.9.9', {
        cwd: path.join(testDir, 'no-local'),
        cliPackageRoot: path.join(testDir, 'no-pkg'),
        fetchImpl,
      }),
    ).rejects.toThrow(/Could not fetch vue template/);
  });

  test('fetchTemplateFiles writes binary assets via arrayBuffer', async () => {
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('src/assets/hero.png')) {
        return {
          ok: true,
          arrayBuffer: async () => bytes.buffer,
          text: async () => {
            throw new Error('should not text-decode png');
          },
        };
      }
      return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
    });

    const result = await fetchTemplateFiles('https://example.test/react', testDir, 'react', {
      fetchImpl,
    });

    expect(result.fetched).toContain('src/assets/hero.png');
    expect(fs.readFileSync(path.join(testDir, 'src/assets/hero.png'))).toEqual(
      Buffer.from(bytes.buffer),
    );
  });

  test('resolveFrameworkTemplate uses github-tag when manifest ok', async () => {
    const target = path.join(testDir, 'tagged');
    const fetchImpl = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/v1.2.3/') && u.endsWith('package.json')) {
        return {
          ok: true,
          text: async () => '{"name":"vue-starter"}',
          arrayBuffer: async () => new TextEncoder().encode('{"name":"vue-starter"}').buffer,
        };
      }
      if (u.includes('/v1.2.3/')) {
        const body = 'file-body';
        return {
          ok: true,
          text: async () => body,
          arrayBuffer: async () => new TextEncoder().encode(body).buffer,
        };
      }
      return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
    });

    const result = await resolveFrameworkTemplate('vue', target, '1.2.3', {
      cwd: path.join(testDir, 'no-local'),
      cliPackageRoot: path.join(testDir, 'no-pkg'),
      fetchImpl,
    });

    expect(result).toEqual({ source: 'github-tag', ref: 'v1.2.3' });
    expect(fs.existsSync(path.join(target, 'package.json'))).toBe(true);
  });
});
